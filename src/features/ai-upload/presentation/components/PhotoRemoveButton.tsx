import { X } from "lucide-react";

export type PhotoRemoveButtonProps = {
  photoName: string;
  onRemove: () => void;
  disabled?: boolean;
};

/**
 * Project-photo delete control.
 *
 * Always visible on small/touch viewports (no hover). Desktop keeps the
 * hover-reveal so the grid is not permanently covered by chrome.
 */
export function PhotoRemoveButton({ photoName, onRemove, disabled }: PhotoRemoveButtonProps) {
  return (
    <button
      type="button"
      onClick={onRemove}
      disabled={disabled}
      aria-label={`Remove ${photoName}`}
      data-testid="photo-remove-button"
      className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-background/90 text-foreground opacity-100 backdrop-blur transition-opacity hover:bg-destructive hover:text-destructive-foreground disabled:pointer-events-none disabled:opacity-50 md:h-7 md:w-7 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
    >
      <X className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  );
}
