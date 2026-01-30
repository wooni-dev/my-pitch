export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://api.my-pitch";
export const MAX_FILE_SIZE_MB = parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB || "7", 10);
export const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024; // bytes

export const AUDIO_FILE_EXTENSIONS = [".wav", ".mp3", ".flac", ".ogg"];

