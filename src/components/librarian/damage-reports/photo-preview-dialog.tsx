
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type PhotoPreviewDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    images: string[];
    index: number;
    onPrev: () => void;
    onNext: () => void;
};

export function PhotoPreviewDialog({
    open,
    onOpenChange,
    images,
    index,
    onPrev,
    onNext,
}: PhotoPreviewDialogProps) {
    const dialogScrollbarClasses =
        "[scrollbar-width:thin] [scrollbar-color:#334155_transparent] " +
        "[&::-webkit-scrollbar]:w-2 " +
        "[&::-webkit-scrollbar-track]:bg-transparent " +
        "[&::-webkit-scrollbar-thumb]:bg-slate-700 " +
        "[&::-webkit-scrollbar-thumb]:rounded-full " +
        "[&::-webkit-scrollbar-thumb:hover]:bg-slate-600";

    const currentPhotoUrl =
        images.length > 0 ? images[Math.min(Math.max(index, 0), images.length - 1)] : "";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl bg-slate-900 text-white border-white/10 max-h-[70vh] overflow-hidden">
                <DialogHeader>
                    <DialogTitle className="text-sm">
                        Damage photo preview
                        {images.length > 1 ? ` (${index + 1} of ${images.length})` : ""}
                    </DialogTitle>
                </DialogHeader>

                <div className={`max-h-[calc(70vh-4.25rem)] overflow-y-auto pr-2 ${dialogScrollbarClasses}`}>
                    {currentPhotoUrl ? (
                        <div className="mt-2 flex flex-col gap-4">
                            <div className="relative max-h-[52vh] overflow-hidden rounded-lg border border-white/20 bg-black/40">
                                <img src={currentPhotoUrl} alt="Damage proof" className="max-h-[52vh] w-full object-contain" />
                            </div>

                            {images.length > 1 && (
                                <div className="flex items-center justify-between text-xs text-white/70">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="border-white/20 text-white/80 hover:bg-white/10"
                                        onClick={onPrev}
                                    >
                                        Previous
                                    </Button>
                                    <span>
                                        Image {index + 1} of {images.length}
                                    </span>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="border-white/20 text-white/80 hover:bg-white/10"
                                        onClick={onNext}
                                    >
                                        Next
                                    </Button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-xs text-white/60">No image to preview.</p>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}