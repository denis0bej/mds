import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import {
  DEFAULT_AVATAR_CROP,
  renderCircularAvatar,
  type AvatarCropSettings,
} from "@/lib/avatarCrop";

type AvatarCropDialogProps = {
  open: boolean;
  image: HTMLImageElement | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (croppedDataUrl: string) => void;
};

export function AvatarCropDialog({ open, image, onOpenChange, onConfirm }: AvatarCropDialogProps) {
  const [settings, setSettings] = useState<AvatarCropSettings>(DEFAULT_AVATAR_CROP);

  useEffect(() => {
    if (open) {
      setSettings(DEFAULT_AVATAR_CROP);
    }
  }, [open, image]);

  const previewUrl = useMemo(() => {
    if (!image) return null;
    return renderCircularAvatar(image, settings);
  }, [image, settings]);

  const updateSetting = (key: keyof AvatarCropSettings, value: number) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleConfirm = () => {
    if (!image || !previewUrl) return;
    onConfirm(previewUrl);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-gold">
        <DialogHeader>
          <DialogTitle className="font-display tracking-wide text-primary">Crop Avatar</DialogTitle>
          <DialogDescription>
            Adjust zoom and position so the portrait fits the circular frame.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-2">
          <div className="relative w-40 h-40 rounded-full border-2 border-gold overflow-hidden bg-card glow-gold shrink-0">
            {image && (
              <img
                src={previewUrl ?? undefined}
                alt="Avatar preview"
                className="h-full w-full object-cover"
              />
            )}
          </div>

          <div className="w-full space-y-5">
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-display uppercase tracking-wider text-muted-foreground">
                <span>Zoom</span>
                <span>{Math.round(settings.scale * 100)}%</span>
              </div>
              <Slider
                min={1}
                max={3}
                step={0.01}
                value={[settings.scale]}
                onValueChange={([value]) => updateSetting("scale", value)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-display uppercase tracking-wider text-muted-foreground">
                <span>Horizontal</span>
              </div>
              <Slider
                min={-1}
                max={1}
                step={0.01}
                value={[settings.offsetX]}
                onValueChange={([value]) => updateSetting("offsetX", value)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-display uppercase tracking-wider text-muted-foreground">
                <span>Vertical</span>
              </div>
              <Slider
                min={-1}
                max={1}
                step={0.01}
                value={[settings.offsetY]}
                onValueChange={([value]) => updateSetting("offsetY", value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="btn-fantasy text-xs px-6 bg-secondary text-secondary-foreground border-gold hover:bg-muted"
          >
            Cancel
          </button>
          <button type="button" onClick={handleConfirm} className="btn-fantasy text-xs px-6">
            Apply
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
