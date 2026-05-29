import { useState } from "react";
import { Loader2, Plus, Trash2, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  formatLastPlayed,
  formatSavePhaseLabel,
  type GameSaveSummary,
} from "@/lib/gameSaves";

type SavePickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saves: GameSaveSummary[];
  activeSaveId: string | null;
  isLoading?: boolean;
  isSwitching?: boolean;
  onSelect: (saveId: string) => void;
  onDelete: (saveId: string) => void;
  onNewCharacter: () => void;
};

export function SavePickerDialog({
  open,
  onOpenChange,
  saves,
  activeSaveId,
  isLoading = false,
  isSwitching = false,
  onSelect,
  onDelete,
  onNewCharacter,
}: SavePickerDialogProps) {
  const [pendingDelete, setPendingDelete] = useState<GameSaveSummary | null>(null);

  const handleConfirmDelete = () => {
    if (!pendingDelete) return;
    onDelete(pendingDelete.id);
    setPendingDelete(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg border-gold bg-card">
          <DialogHeader>
            <DialogTitle className="font-display text-primary tracking-wider">
              Switch Character
            </DialogTitle>
            <DialogDescription className="font-body text-sm">
              Choose a saved hero or start a new one.
            </DialogDescription>
          </DialogHeader>

          <button
            type="button"
            disabled={isSwitching}
            onClick={() => {
              onOpenChange(false);
              onNewCharacter();
            }}
            className="narrative-panel border-dashed border-gold/50 w-full flex items-center gap-3 px-4 py-3 text-left hover:border-primary/50 hover:bg-primary/5 transition-colors disabled:opacity-50"
          >
            <div className="w-8 h-8 rounded-full border border-gold/50 flex items-center justify-center shrink-0">
              <Plus className="h-4 w-4 text-primary" />
            </div>
            <div>
              <span className="font-display text-sm text-primary tracking-wider block">
                New Character
              </span>
              <span className="font-body text-[11px] text-muted-foreground">
                Forge a new hero — existing saves stay on your account
              </span>
            </div>
          </button>

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="font-body text-sm">Loading your saves...</span>
            </div>
          ) : saves.length === 0 ? (
            <div className="narrative-panel text-center py-6">
              <User className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="font-body text-sm text-muted-foreground">
                No saved characters yet. Use New Character above to begin.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {saves.map((save) => {
                const isActive = save.id === activeSaveId;
                const locationName = save.save_data.currentNodeId
                  ? save.save_data.map?.nodes.find((n) => n.id === save.save_data.currentNodeId)?.name
                  : null;

                return (
                  <div
                    key={save.id}
                    className={`narrative-panel flex items-start gap-3 transition-colors ${
                      isActive ? "border-primary/60 bg-primary/5" : "border-gold/30"
                    }`}
                  >
                    <button
                      type="button"
                      disabled={isSwitching || isActive}
                      onClick={() => onSelect(save.id)}
                      className="flex-1 min-w-0 text-left disabled:cursor-default"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-display text-sm text-primary tracking-wider">
                          {save.character_name}
                        </span>
                        {isActive && (
                          <span className="text-[10px] uppercase tracking-wider text-primary/80 font-display">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="font-body text-xs text-muted-foreground mt-1">
                        {save.character.race} · {save.character.characterClass}
                      </p>
                      <p className="font-body text-[11px] text-muted-foreground/80 mt-1">
                        {formatSavePhaseLabel(save.phase)}
                        {locationName ? ` · ${locationName}` : ""}
                        {" · "}
                        {formatLastPlayed(save.updated_at)}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(save)}
                      disabled={isSwitching}
                      className="p-2 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                      title="Delete character"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {isSwitching && (
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading character...
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(next) => !next && setPendingDelete(null)}>
        <AlertDialogContent className="border-gold bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-primary tracking-wider">
              Delete character?
            </AlertDialogTitle>
            <AlertDialogDescription className="font-body text-sm leading-relaxed">
              {pendingDelete ? (
                <>
                  Permanently delete <strong>{pendingDelete.character_name}</strong> and all adventure
                  progress? This cannot be undone.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-display text-xs uppercase tracking-wider">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-display text-xs uppercase tracking-wider"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
