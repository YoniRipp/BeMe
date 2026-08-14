import { useState } from 'react';
import { Exercise } from '@/types/workout';
import { ImagePlaceholder } from '@/components/shared/ImagePlaceholder';
import { useExercises } from '@/hooks/useExercises';
import { useSettings } from '@/hooks/useSettings';
import { getWeightUnit } from '@/lib/utils';
import { Play, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

interface ExerciseListProps {
  exercises: Exercise[];
}

function isYouTubeUrl(url: string): boolean {
  return /(?:youtube\.com|youtu\.be)/.test(url);
}

function getYouTubeEmbedUrl(url: string): string {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : url;
}

export function ExerciseList({ exercises }: ExerciseListProps) {
  const { settings } = useSettings();
  const unit = getWeightUnit(settings.units);
  const { getImageUrl, getVideoUrl } = useExercises();
  const [videoModal, setVideoModal] = useState<{ name: string; url: string } | null>(null);

  if (exercises.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No exercises added</p>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {exercises.map((exercise, idx) => {
          const videoUrl = getVideoUrl(exercise.name);
          return (
            <div key={idx} className="flex items-center gap-3 p-2 bg-muted rounded-xl">
              <div className="relative">
                <ImagePlaceholder type="exercise" size="sm" imageUrl={getImageUrl(exercise.name)} />
                {videoUrl && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setVideoModal({ name: exercise.name, url: videoUrl });
                    }}
                    className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg"
                    aria-label={`Play video for ${exercise.name}`}
                  >
                    <Play className="w-4 h-4 text-white fill-white" />
                  </button>
                )}
              </div>
              <div>
                <p className="text-sm font-medium">{exercise.name}</p>
                <p className="text-sm text-muted-foreground">
                  {exercise.sets} sets × {exercise.reps} reps
                  {exercise.weight && ` ${exercise.weight} ${unit}`}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!videoModal} onOpenChange={() => setVideoModal(null)}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          {videoModal && (
            <div>
              <div className="flex items-center justify-between gap-2 p-3 border-b">
                {/* Doubles as the dialog's accessible name, so it is a DialogTitle
                    rather than a styled paragraph. */}
                <DialogTitle className="text-sm font-medium">{videoModal.name}</DialogTitle>
                <DialogDescription className="sr-only">
                  Demonstration video for {videoModal.name}.
                </DialogDescription>
                <button
                  type="button"
                  onClick={() => setVideoModal(null)}
                  aria-label="Close video"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="aspect-video bg-scrim">
                {isYouTubeUrl(videoModal.url) ? (
                  <iframe
                    src={getYouTubeEmbedUrl(videoModal.url)}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={`${videoModal.name} exercise video`}
                  />
                ) : (
                  <video
                    src={videoModal.url}
                    className="w-full h-full"
                    controls
                    autoPlay
                    playsInline
                  >
                    Your browser does not support video playback.
                  </video>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
