-- Create trigger to automatically confirm user email registrations
-- This bypasses email verification requirements for development and testing

CREATE OR REPLACE FUNCTION public.auto_confirm_user_email()
RETURNS TRIGGER AS $$
BEGIN
  NEW.email_confirmed_at = now();
  NEW.confirmed_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if it already exists
DROP TRIGGER IF EXISTS tr_auto_confirm_user_email ON auth.users;

-- Create the trigger on auth.users in the BEFORE INSERT phase
CREATE TRIGGER tr_auto_confirm_user_email
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_confirm_user_email();

-- Also confirm any existing users who have not been confirmed yet
UPDATE auth.users
SET email_confirmed_at = now(), confirmed_at = now()
WHERE email_confirmed_at IS NULL;
