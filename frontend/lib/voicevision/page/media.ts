// SPARSH VoiceVision — Page Media Controller
// Manages HTML5 <video> elements on lessons and classrooms.
// Honestly reports YouTube iframe manipulation as unsupported as the app uses native HTML5 video.

export class PageMediaController {
  private static getVideoElement(): HTMLVideoElement | null {
    if (typeof document === 'undefined') return null;

    // Prefer ID #lesson-video
    const lessonVid = document.getElementById('lesson-video') as HTMLVideoElement;
    if (lessonVid) return lessonVid;

    // Any video element on the page
    return document.querySelector('video');
  }

  public static isVideoPresent(): boolean {
    return PageMediaController.getVideoElement() !== null;
  }

  public static play(): { success: boolean; message: string } {
    const video = PageMediaController.getVideoElement();
    if (!video) {
      return { success: false, message: 'No lesson video found on this page.' };
    }

    try {
      video.play();
      return { success: true, message: 'Playing lesson video.' };
    } catch (e: any) {
      return { success: false, message: 'Could not start video playback.' };
    }
  }

  public static pause(): { success: boolean; message: string } {
    const video = PageMediaController.getVideoElement();
    if (!video) {
      return { success: false, message: 'No lesson video found on this page.' };
    }

    video.pause();
    return { success: true, message: 'Lesson video paused.' };
  }

  public static seek(deltaSeconds: number): { success: boolean; message: string } {
    const video = PageMediaController.getVideoElement();
    if (!video) {
      return { success: false, message: 'No lesson video found on this page.' };
    }

    video.currentTime = Math.max(0, video.currentTime + deltaSeconds);
    const direction = deltaSeconds >= 0 ? 'forward' : 'back';
    return { success: true, message: `Skipped ${direction} ${Math.abs(deltaSeconds)} seconds.` };
  }
}
