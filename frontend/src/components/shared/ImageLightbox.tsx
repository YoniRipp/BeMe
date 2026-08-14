import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { X } from 'lucide-react';

interface ImageLightboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string;
  alt: string;
}

export function ImageLightbox({ open, onOpenChange, src, alt }: ImageLightboxProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 bg-transparent border-none shadow-none [&>button]:hidden">
        {/* The image carries the meaning; the dialog still needs a name and a description
            or Radix warns and screen readers announce an unlabelled dialog. */}
        <DialogTitle className="sr-only">{alt || 'Image preview'}</DialogTitle>
        <DialogDescription className="sr-only">
          Enlarged view. Press Escape to close.
        </DialogDescription>
        <div className="relative flex flex-col items-center">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute -top-12 right-0 flex h-11 w-11 items-center justify-center rounded-full bg-scrim/70 text-scrim-foreground hover:bg-scrim/90 transition-colors"
            aria-label="Close image preview"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={src}
            alt={alt}
            decoding="async"
            className="max-h-[70vh] w-auto rounded-xl object-contain"
          />
          {alt && (
            <p className="mt-3 text-sm font-medium text-center text-scrim-foreground">{alt}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
