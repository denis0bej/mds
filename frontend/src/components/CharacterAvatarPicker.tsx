import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Camera, User } from "lucide-react";
import { AvatarCropDialog } from "@/components/AvatarCropDialog";
import { loadImageFromFile } from "@/lib/avatarCrop";
import { cn } from "@/lib/utils";

type CharacterAvatarPickerProps = {
  avatar?: string | null;
  onAvatarChange?: (dataUrl: string) => void;
  editable?: boolean;
  size?: "lg" | "sm";
  label?: string;
  className?: string;
};

const SIZE_CLASSES = {
  lg: "w-40 h-40",
  sm: "w-16 h-16",
};

const ICON_CLASSES = {
  lg: "h-16 w-16",
  sm: "h-7 w-7",
};

export function CharacterAvatarPicker({
  avatar,
  onAvatarChange,
  editable = true,
  size = "lg",
  label = "Character Avatar",
  className,
}: CharacterAvatarPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [cropImage, setCropImage] = useState<HTMLImageElement | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePickFile = () => {
    if (!editable) return;
    setError(null);
    inputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const img = await loadImageFromFile(file);
      setCropImage(img);
      setCropOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load image.");
    }
  };

  const handleCropConfirm = (dataUrl: string) => {
    onAvatarChange?.(dataUrl);
    setCropImage(null);
  };

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <motion.button
        type="button"
        onClick={handlePickFile}
        disabled={!editable}
        whileHover={editable ? { scale: 1.03 } : undefined}
        whileTap={editable ? { scale: 0.98 } : undefined}
        className={cn(
          "relative rounded-full border-2 border-gold bg-card glow-gold overflow-hidden group",
          SIZE_CLASSES[size],
          editable ? "cursor-pointer" : "cursor-default",
        )}
        aria-label={editable ? "Upload character avatar" : "Character avatar"}
      >
        {avatar ? (
          <img src={avatar} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <User className={cn("text-primary/50", ICON_CLASSES[size])} />
          </div>
        )}

        {editable && (
          <motion.div
            initial={false}
            className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-full bg-black/65 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          >
            <motion.div
              animate={{ y: [0, -2, 0] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            >
              <Camera
                className={cn(
                  "text-primary",
                  size === "lg" ? "h-7 w-7" : "h-5 w-5",
                )}
              />
            </motion.div>
            {size === "lg" && (
              <span className="font-display text-[9px] uppercase tracking-wider px-2 text-center leading-tight text-primary">
                Click to upload
              </span>
            )}
          </motion.div>
        )}
      </motion.button>

      {label && (
        <span className="font-display text-xs uppercase tracking-widest text-muted-foreground text-center">
          {label}
        </span>
      )}

      {error && <p className="text-destructive text-xs text-center max-w-[10rem]">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/jpg,.jpg,.jpeg,.png"
        className="hidden"
        onChange={handleFileChange}
      />

      <AvatarCropDialog
        open={cropOpen}
        image={cropImage}
        onOpenChange={(open) => {
          setCropOpen(open);
          if (!open) setCropImage(null);
        }}
        onConfirm={handleCropConfirm}
      />
    </div>
  );
}
