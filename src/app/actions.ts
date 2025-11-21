
"use server";

import {
  passportPhotoAutoCenter,
  type PassportPhotoAutoCenterInput,
} from "@/ai/flows/passport-photo-auto-center";
import {
  removeBackground,
  type RemoveBackgroundInput,
} from "@/ai/flows/remove-background";

export async function autoCenterPassportPhoto(
  input: PassportPhotoAutoCenterInput
) {
  try {
    const result = await passportPhotoAutoCenter(input);
    return { data: result, error: null };
  } catch (error) {
    console.error("Error in autoCenterPassportPhoto:", error);
    // This is a placeholder for a more specific error message.
    // In a real app, you might want to inspect the error object.
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred.";
    return {
      data: null,
      error: `Failed to process the image. ${errorMessage}`,
    };
  }
}

// removeImageBackground removed as it is now handled client-side
