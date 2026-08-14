# Guide to Android APK Generation & In-App Updates

This guide documents how to compile the **Business Market** e-commerce app into a signed production-ready Android APK using **Capacitor** and manage seamless over-the-air (OTA) style or manual APK updates.

---

## 1. Local Android Build Environment Setup

Capacitor acts as a wrapper around the web assets built by Vite, allowing you to deploy the same codebase as a fully native Android app.

### Prerequisites on your Local Machine:
1. **Node.js** (v18 or newer)
2. **Android Studio** (with Android SDK & build tools installed)
3. **Java Development Kit (JDK 17)** configured in your path

---

## 2. Generating the Signed Production APK

Follow these steps on your local machine to build and package a signed APK that you can install on your phone.

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Build and Sync Android Web Assets
Compile the React/Vite assets and sync them directly into the Android native assets directory in one step:
```bash
npm run cap:sync
```
*Note: `npm run cap:sync` runs `npm run build` first to ensure 100% of the latest web code, features, and fixes are compiled into `dist/` and copied to `android/app/src/main/assets/public/`.*

### Step 3: Add Android Platform (First Time Only)
If you haven't added the Android platform yet:
```bash
npm run cap:add
```

### Step 4: Open in Android Studio
Launch Android Studio with the Capacitor project:
```bash
npx cap open android
```

### Step 5: Configure Versioning (Step-by-step)
Inside Android Studio, open the `android/app/build.gradle` file. Look for the `defaultConfig` block to increase your version:
```groovy
defaultConfig {
    applicationId "dz.businessmarket.app"
    minSdkVersion 22
    targetSdkVersion 34
    versionCode 101       // Increment this for EVERY release (e.g. 100 -> 101)
    versionName "1.0.1"   // Increment the display name (e.g. "1.0.0" -> "1.0.1")
    ...
}
```

### Step 6: Generate a Signed Release APK
1. In Android Studio, go to **Build** > **Generate Signed Bundle / APK...**
2. Choose **APK** and click **Next**.
3. Create a new Keystore or select an existing one to sign the APK.
4. Set the Build Type to **release**.
5. Click **Finish**. Android Studio will compile your code and produce a signed release APK (e.g., `app-release.apk`) inside your project directory under `android/app/release/`.

---

## 3. Uploading & Publishing a New Update

To let users update without uninstalling, you need to sign future releases with the **exact same Keystore**. Android enforces that apps with the same Package ID (`dz.businessmarket.app`) signed by the same keystore can be seamlessly installed on top of each other while preserving all local storage, settings, and user session data.

### Option A: GitHub Releases (Recommended & Free)
1. Commit and push your code to a GitHub repository.
2. Go to your repository > **Releases** > **Draft a new release**.
3. Create a tag matching your version (e.g., `v1.0.1`).
4. Upload your generated `app-release.apk` file under the assets section.
5. Publish the release.
6. Copy the direct link to the uploaded `.apk` file (e.g., `https://github.com/your-username/your-repo/releases/download/v1.0.1/app-release.apk`).

### Option B: Supabase Storage Bucket
1. Open your Supabase Dashboard.
2. Go to **Storage** and create a new public bucket named `apk-releases`.
3. Upload your `app-release.apk`.
4. Copy the public download URL of the uploaded file.

---

## 4. Triggering the In-App Update Prompt

You can manage the update parameters directly from the built-in **Business Market Admin Panel**:

1. Log in to the Admin Panel of your application.
2. Go to **System Settings** (التحكم في النظام).
3. Scroll down to the **Android Mobile App Updates (تحديثات تطبيق الأندرويد)** card.
4. Fill in the update metadata:
   - **Version Code**: Set this to match your newly built version code (e.g. `101`).
   - **Version Name**: Set the display name (e.g. `1.0.1`).
   - **APK Download URL**: Paste your direct APK link from GitHub or Supabase Storage.
   - **Mandatory Update**: Check this if you want to block the app until the user updates.
   - **Release Notes**: Describe the changes in both Arabic and French.
5. Click **Save Update Settings**.

Once saved, **every active user** on an older version of your app (Version Code `< 101`) will instantly see a beautiful modal pop up in the app with your release notes and an **"Update Now"** button. They can download and apply the update with a single click!
