// "Choose from Google Drive" on the upload page. Google's own file picker
// opens over the page; the photographer signs in to Google there and picks
// photos, and Folio may then read only the files they picked (the drive.file
// permission, never the rest of their Drive). The browser downloads each one
// and hands it to the ordinary uploader, so a Drive photo goes through exactly
// the same checks, compression and storage as one from the computer.
import { UPLOAD_TYPES } from "./compress-image";
import { UploadError } from "./photo-upload";

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const IDENTITY_SCRIPT = "https://accounts.google.com/gsi/client";
const PICKER_SCRIPT = "https://apis.google.com/js/api.js";
const DRIVE_TYPES = [...UPLOAD_TYPES, "image/heic", "image/heif"];

// Hosts the picker and its sign-in load from (lib/security-headers.ts).
export const DRIVE_HOSTS = {
  script: ["https://accounts.google.com", "https://apis.google.com"],
  style: ["https://accounts.google.com"],
  frame: ["https://accounts.google.com", "https://docs.google.com", "https://content.googleapis.com"],
  connect: ["https://accounts.google.com", "https://www.googleapis.com"],
};

export type DriveConfig = { clientId: string; apiKey: string; appId: string };

// The picker needs the OAuth client "Continue with Google" already uses and a
// browser API key. Without both, the button isn't shown.
export function driveConfig(env: Record<string, string | undefined> = process.env): DriveConfig | null {
  const clientId = env.GOOGLE_CLIENT_ID;
  const apiKey = env.GOOGLE_PICKER_API_KEY;
  // The picker's app id is the Google Cloud project number, which every
  // client id starts with ("123456789-abc.apps.googleusercontent.com").
  const appId = clientId && /^(\d+)-/.exec(clientId)?.[1];
  if (!clientId || !apiKey || !appId) return null;
  return { clientId, apiKey, appId };
}

// A photo picked in Drive, not downloaded yet. `name` and `type` are what
// photoType (lib/compress-image.ts) reads, so it's checked before downloading.
export type DriveFile = {
  drive: true;
  id: string;
  name: string;
  type: string;
  size: number;
  resourceKey?: string; // for files opened through an old shared link
  token: string;
};

export const isDriveFile = (x: File | DriveFile): x is DriveFile => "drive" in x;

// The picker's answer ("docs") as files to download.
export function pickedFiles(docs: Record<string, unknown>[], token: string): DriveFile[] {
  return docs.flatMap((doc) => {
    const id = typeof doc.id === "string" ? doc.id : "";
    if (!id) return [];
    return [
      {
        drive: true as const,
        id,
        name: typeof doc.name === "string" && doc.name ? doc.name : "photo from Google Drive",
        type: typeof doc.mimeType === "string" ? doc.mimeType : "",
        size: Number(doc.sizeBytes) || 0,
        resourceKey: typeof doc.resourceKey === "string" ? doc.resourceKey : undefined,
        token,
      },
    ];
  });
}

export async function downloadDriveFile(file: DriveFile): Promise<File> {
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media&supportsAllDrives=true`;
  const headers: Record<string, string> = { Authorization: `Bearer ${file.token}` };
  if (file.resourceKey) headers["X-Goog-Drive-Resource-Keys"] = `${file.id}/${file.resourceKey}`;
  let res: Response;
  try {
    res = await fetch(url, { headers });
  } catch {
    throw new UploadError("couldn't reach Google Drive", true);
  }
  if (res.status === 401) throw new UploadError("the Google Drive sign-in ran out, so choose it from Drive again");
  if (res.status === 429 || res.status >= 500) throw new UploadError("Google Drive is busy right now", true);
  if (res.status === 403 || res.status === 404) throw new UploadError("Google Drive wouldn't let Folio download it");
  if (!res.ok) throw new UploadError("couldn't be downloaded from Google Drive");
  let blob: Blob;
  try {
    blob = await res.blob();
  } catch {
    throw new UploadError("the download from Google Drive was cut off", true);
  }
  return new File([blob], file.name, { type: file.type || blob.type });
}

// Just enough of Google's two browser libraries for the code below.
type TokenResponse = { access_token?: string; expires_in?: number; error?: string };
type GoogleApis = {
  accounts: {
    oauth2: {
      initTokenClient(options: {
        client_id: string;
        scope: string;
        callback: (res: TokenResponse) => void;
        error_callback?: (err: { type: string }) => void;
      }): { requestAccessToken(options?: { prompt?: string }): void };
    };
  };
  picker: {
    DocsView: new (viewId: string) => PickerView;
    PickerBuilder: new () => PickerBuilder;
    ViewId: { DOCS_IMAGES: string };
    Feature: { MULTISELECT_ENABLED: string };
    Action: { PICKED: string; CANCEL: string };
  };
};
type PickerView = {
  setIncludeFolders(on: boolean): PickerView;
  setMimeTypes(types: string): PickerView;
};
type PickerBuilder = {
  addView(view: PickerView): PickerBuilder;
  enableFeature(feature: string): PickerBuilder;
  setOAuthToken(token: string): PickerBuilder;
  setDeveloperKey(key: string): PickerBuilder;
  setAppId(id: string): PickerBuilder;
  setOrigin(origin: string): PickerBuilder;
  setTitle(title: string): PickerBuilder;
  setCallback(fn: (data: { action: string; docs?: Record<string, unknown>[] }) => void): PickerBuilder;
  build(): { setVisible(on: boolean): void };
};

declare global {
  interface Window {
    google?: GoogleApis;
    gapi?: { load(lib: string, done: () => void): void };
  }
}

const scripts = new Map<string, Promise<void>>();

function loadScript(src: string) {
  let loading = scripts.get(src);
  if (!loading) {
    loading = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        scripts.delete(src);
        reject(new Error("Google Drive couldn't be loaded"));
      };
      document.head.appendChild(script);
    });
    scripts.set(src, loading);
  }
  return loading;
}

// Loads both libraries ahead of the click: the Google sign-in window must be
// opened straight from the click, or the browser blocks it as a pop-up.
export async function loadDrive() {
  await Promise.all([
    loadScript(IDENTITY_SCRIPT),
    loadScript(PICKER_SCRIPT).then(() => new Promise<void>((resolve) => window.gapi!.load("picker", resolve))),
  ]);
}

// Reused until shortly before it runs out, so picking again doesn't ask again.
let saved: { token: string; until: number } | null = null;

function requestToken(config: DriveConfig) {
  if (saved && saved.until > Date.now()) return Promise.resolve(saved.token);
  return new Promise<string>((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: config.clientId,
      scope: DRIVE_SCOPE,
      callback: (res) => {
        if (!res.access_token) return reject(new Error(res.error ?? "Google didn't allow access"));
        saved = { token: res.access_token, until: Date.now() + ((res.expires_in ?? 3600) - 300) * 1000 };
        resolve(res.access_token);
      },
      // The sign-in window was closed, or blocked as a pop-up.
      error_callback: (err) => reject(new Error(err.type === "popup_failed_to_open" ? "allow pop-ups for Folio to use Google Drive" : "cancelled")),
    });
    client.requestAccessToken({ prompt: "" });
  });
}

// Signs in to Google if needed, shows the picker, and returns what was picked
// (nothing if the picker was closed). Call loadDrive first, and call this
// straight from a click.
export async function pickFromDrive(config: DriveConfig): Promise<DriveFile[]> {
  const token = await requestToken(config);
  const { picker } = window.google!;
  return new Promise((resolve) => {
    const view = new picker.DocsView(picker.ViewId.DOCS_IMAGES).setIncludeFolders(true).setMimeTypes(DRIVE_TYPES.join(","));
    new picker.PickerBuilder()
      .addView(view)
      .enableFeature(picker.Feature.MULTISELECT_ENABLED)
      .setOAuthToken(token)
      .setDeveloperKey(config.apiKey)
      .setAppId(config.appId)
      .setOrigin(window.location.origin)
      .setTitle("Choose photos to upload to Folio")
      .setCallback((data) => {
        if (data.action === picker.Action.PICKED) resolve(pickedFiles(data.docs ?? [], token));
        else if (data.action === picker.Action.CANCEL) resolve([]);
      })
      .build()
      .setVisible(true);
  });
}
