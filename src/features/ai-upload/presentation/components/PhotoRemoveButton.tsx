import { X } from "lucide-react";

export type PhotoRemoveButtonProps = {
  photoName: string;
  onRemove: () => void;
  disabled?: boolean;
};

/**
 * Project-photo delete control.
 *
 * Visibility and target size are owned by pointer capability, not viewport
 * width. Base and any-pointer-coarse stay 44px/visible; pointer-fine alone
 * may use compact hover/focus reveal.
 */
export function PhotoRemoveButton({ photoName, onRemove, disabled }: PhotoRemoveButtonProps) {
  return (
    <button
      type="button"
      onClick={onRemove}
      disabled={disabled}
      aria-label={`Remove ${photoName}`}
      data-testid="photo-remove-button"
      className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-background/90 text-foreground opacity-100 backdrop-blur transition-opacity hover:bg-destructive hover:text-destructive-foreground disabled:pointer-events-none disabled:opacity-50 pointer-fine:h-7 pointer-fine:w-7 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-visible:opacity-100 any-pointer-coarse:h-11 any-pointer-coarse:w-11 any-pointer-coarse:opacity-100"
    >
      <X className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  );
}
