package com.businessmarket.app;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {

    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void getAppVersion(PluginCall call) {
        try {
            Context context = getContext();
            PackageInfo pInfo = context.getPackageManager().getPackageInfo(context.getPackageName(), 0);
            long versionCode;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                versionCode = pInfo.getLongVersionCode();
            } else {
                versionCode = pInfo.versionCode;
            }

            JSObject ret = new JSObject();
            ret.put("versionCode", versionCode);
            ret.put("versionName", pInfo.versionName != null ? pInfo.versionName : "1.0.0");
            ret.put("packageName", context.getPackageName());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to get app version: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void canRequestPackageInstalls(PluginCall call) {
        JSObject ret = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            boolean canInstall = getContext().getPackageManager().canRequestPackageInstalls();
            ret.put("canInstall", canInstall);
        } else {
            ret.put("canInstall", true);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void openInstallPermissionSettings(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                call.resolve();
            } else {
                call.resolve();
            }
        } catch (Exception e) {
            call.reject("Failed to open settings: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String apkUrl = call.getString("url");
        if (apkUrl == null || apkUrl.trim().isEmpty()) {
            call.reject("Missing APK download URL");
            return;
        }

        call.resolve();

        executor.execute(() -> {
            File tempApk = null;
            HttpURLConnection connection = null;
            InputStream input = null;
            FileOutputStream output = null;

            try {
                Context context = getContext();
                URL url = new URL(apkUrl);
                connection = (HttpURLConnection) url.openConnection();
                connection.setConnectTimeout(30000);
                connection.setReadTimeout(60000);
                connection.setInstanceFollowRedirects(true);
                connection.setRequestProperty("User-Agent", "BusinessMarketApp/" + Build.VERSION.RELEASE);
                connection.connect();

                // Handle HTTP redirects (GitHub Releases redirect 302 to AWS S3)
                int responseCode = connection.getResponseCode();
                int redirectCount = 0;
                while ((responseCode == HttpURLConnection.HTTP_MOVED_TEMP
                        || responseCode == HttpURLConnection.HTTP_MOVED_PERM
                        || responseCode == HttpURLConnection.HTTP_SEE_OTHER
                        || responseCode == 307
                        || responseCode == 308) && redirectCount < 5) {
                    String newUrl = connection.getHeaderField("Location");
                    connection.disconnect();
                    url = new URL(newUrl);
                    connection = (HttpURLConnection) url.openConnection();
                    connection.setConnectTimeout(30000);
                    connection.setReadTimeout(60000);
                    connection.setInstanceFollowRedirects(true);
                    connection.setRequestProperty("User-Agent", "BusinessMarketApp/" + Build.VERSION.RELEASE);
                    connection.connect();
                    responseCode = connection.getResponseCode();
                    redirectCount++;
                }

                if (responseCode != HttpURLConnection.HTTP_OK) {
                    notifyDownloadFailed("HTTP error: " + responseCode);
                    return;
                }

                int fileLength = connection.getContentLength();

                File dir = context.getExternalFilesDir(null);
                if (dir == null) {
                    dir = context.getCacheDir();
                }
                tempApk = new File(dir, "update.apk");
                if (tempApk.exists()) {
                    tempApk.delete();
                }

                input = connection.getInputStream();
                output = new FileOutputStream(tempApk);

                byte[] buffer = new byte[16384];
                long total = 0;
                int count;
                long lastProgressTime = 0;

                while ((count = input.read(buffer)) != -1) {
                    total += count;
                    output.write(buffer, 0, count);

                    long now = System.currentTimeMillis();
                    if (now - lastProgressTime > 300 || (fileLength > 0 && total == fileLength)) {
                        lastProgressTime = now;
                        int progress = fileLength > 0 ? (int) ((total * 100) / fileLength) : -1;
                        notifyDownloadProgress(progress, total, fileLength);
                    }
                }

                output.flush();
                output.close();
                output = null;

                input.close();
                input = null;

                connection.disconnect();
                connection = null;

                notifyDownloadComplete();

                // Trigger package installer directly
                installApk(tempApk);

            } catch (Exception e) {
                notifyDownloadFailed(e.getMessage() != null ? e.getMessage() : "Download error");
            } finally {
                try {
                    if (output != null) output.close();
                    if (input != null) input.close();
                    if (connection != null) connection.disconnect();
                } catch (Exception ignored) {}
            }
        });
    }

    @PluginMethod
    public void installApkFile(PluginCall call) {
        try {
            Context context = getContext();
            File dir = context.getExternalFilesDir(null);
            if (dir == null) {
                dir = context.getCacheDir();
            }
            File apkFile = new File(dir, "update.apk");
            if (!apkFile.exists()) {
                call.reject("APK file not found on device");
                return;
            }
            installApk(apkFile);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to trigger installation: " + e.getMessage(), e);
        }
    }

    private void installApk(File apkFile) {
        try {
            Context context = getContext();
            Uri apkUri = FileProvider.getUriForFile(
                    context,
                    context.getPackageName() + ".fileprovider",
                    apkFile
            );

            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            context.startActivity(intent);
        } catch (Exception e) {
            notifyDownloadFailed("Installer launch failed: " + e.getMessage());
        }
    }

    private void notifyDownloadProgress(int percent, long bytesDownloaded, long totalBytes) {
        JSObject data = new JSObject();
        data.put("percent", percent);
        data.put("bytesDownloaded", bytesDownloaded);
        data.put("totalBytes", totalBytes);
        notifyListeners("updateDownloadProgress", data);
    }

    private void notifyDownloadComplete() {
        JSObject data = new JSObject();
        data.put("status", "complete");
        notifyListeners("updateDownloadComplete", data);
    }

    private void notifyDownloadFailed(String error) {
        JSObject data = new JSObject();
        data.put("error", error);
        notifyListeners("updateDownloadFailed", data);
    }
}
