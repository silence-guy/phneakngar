import { Locale, resolveLocale, type Locale as SharedLocale } from "@phneakngar/shared";

type DeviceLabels = {
  heading: string;
  verifying: string;
  enterCode: string;
  requestingAccess: string;
  deviceCode: string;
  verifyCode: string;
  code: string;
  deny: string;
  approving: string;
  approve: string;
  deviceAuthorized: string;
  doneCli: string;
  openDashboard: string;
  accessDenied: string;
  errors: {
    invalidOrExpired: string;
    verifyFailed: string;
    approveFailed: string;
    approveDeviceFailed: string;
    denyDeviceFailed: string;
  };
};

export const DEVICE_LABELS = {
  [Locale.KM]: {
    heading: "អនុញ្ញាតឧបករណ៍",
    verifying: "កំពុងផ្ទៀងផ្ទាត់...",
    enterCode: "បញ្ចូលលេខកូដដែលបង្ហាញនៅលើ terminal របស់អ្នក",
    requestingAccess: "ឧបករណ៍មួយកំពុងស្នើសុំចូលប្រើគណនីរបស់អ្នក",
    deviceCode: "លេខកូដឧបករណ៍",
    verifyCode: "ផ្ទៀងផ្ទាត់លេខកូដ",
    code: "លេខកូដ",
    deny: "បដិសេធ",
    approving: "កំពុងអនុម័ត...",
    approve: "អនុម័ត",
    deviceAuthorized: "✓ ឧបករណ៍ត្រូវបានអនុញ្ញាត",
    doneCli: "អ្នកអាចបិទផ្ទាំងនេះបាន។ CLI នឹងបន្តដោយស្វ័យប្រវត្តិ។",
    openDashboard: "បើកផ្ទាំងគ្រប់គ្រង",
    accessDenied: "ការចូលប្រើឧបករណ៍ត្រូវបានបដិសេធ។ អ្នកអាចបិទផ្ទាំងនេះបាន។",
    errors: {
      invalidOrExpired: "លេខកូដមិនត្រឹមត្រូវ ឬផុតកំណត់",
      verifyFailed: "មិនអាចផ្ទៀងផ្ទាត់លេខកូដបានទេ",
      approveFailed: "មិនអាចអនុម័តបានទេ",
      approveDeviceFailed: "មិនអាចអនុម័តឧបករណ៍បានទេ",
      denyDeviceFailed: "មិនអាចបដិសេធឧបករណ៍បានទេ",
    },
  },
  [Locale.EN]: {
    heading: "Authorize device",
    verifying: "Verifying...",
    enterCode: "Enter the code shown in your terminal",
    requestingAccess: "A device is requesting access to your account",
    deviceCode: "Device code",
    verifyCode: "Verify code",
    code: "Code",
    deny: "Deny",
    approving: "Approving...",
    approve: "Approve",
    deviceAuthorized: "✓ Device authorized",
    doneCli: "You can close this tab. The CLI will continue automatically.",
    openDashboard: "Open dashboard",
    accessDenied: "Device access denied. You can close this tab.",
    errors: {
      invalidOrExpired: "Invalid or expired code",
      verifyFailed: "Couldn't verify the code",
      approveFailed: "Couldn't approve",
      approveDeviceFailed: "Couldn't approve the device",
      denyDeviceFailed: "Couldn't deny the device",
    },
  },
} as const satisfies Record<SharedLocale, DeviceLabels>;

export function getDeviceLabels(locale?: string | null): DeviceLabels {
  return DEVICE_LABELS[resolveLocale(locale)];
}
