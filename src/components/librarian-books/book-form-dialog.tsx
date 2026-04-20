import * as React from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldContent, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
    LIBRARY_AREA_OPTIONS,
    LIBRARY_AREA_OTHER_VALUE,
    formatLibraryAreaLabel,
} from "./books-constants";

export type BookFormMode = "create" | "edit" | "copy" | "edit_copy";

export type BookFormValues = {
    title: string;
    author: string;
    isbn: string;
    issn: string;
    accessionNumber: string;
    subjects: string;
    subtitle: string;
    edition: string;
    pubYear: string;
    placeOfPublication: string;
    publisher: string;
    pages: string;
    otherDetails: string;
    dimensions: string;
    notes: string;
    series: string;
    addedEntries: string;
    barcode: string;
    callNumber: string;
    copyNumber: string;
    volumeNumber: string;
    numberOfCopies: string;
    copiesMode: "set" | "add";
    copiesToAdd: string;
    libraryAreaOption: string;
    libraryAreaOther: string;
    borrowDuration: string;
    available: boolean;
    isLibraryUseOnly: boolean;
};

export type InventorySnapshot = {
    total: number | null;
    borrowed: number | null;
    remaining: number | null;
    activeBorrowCount?: number | null;
    totalBorrowCount?: number | null;
};

export function getDefaultBookFormValues(): BookFormValues {
    return {
        title: "",
        author: "",
        isbn: "",
        issn: "",
        accessionNumber: "",
        subjects: "",
        subtitle: "",
        edition: "",
        pubYear: "",
        placeOfPublication: "",
        publisher: "",
        pages: "",
        otherDetails: "",
        dimensions: "",
        notes: "",
        series: "",
        addedEntries: "",
        barcode: "",
        callNumber: "",
        copyNumber: "",
        volumeNumber: "",
        numberOfCopies: "1",
        copiesMode: "set",
        copiesToAdd: "",
        libraryAreaOption: "",
        libraryAreaOther: "",
        borrowDuration: "7",
        available: true,
        isLibraryUseOnly: false,
    };
}

type BookFormDialogProps = {
    mode: BookFormMode;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    values: BookFormValues;
    onChange: (patch: Partial<BookFormValues>) => void;
    onSubmit: () => void;
    onCancel: () => void;
    submitting: boolean;
    error?: string;
    inventory?: InventorySnapshot | null;
    trigger?: React.ReactNode;
};

export function BookFormDialog({
    mode,
    open,
    onOpenChange,
    values,
    onChange,
    onSubmit,
    onCancel,
    submitting,
    error,
    inventory,
    trigger,
}: BookFormDialogProps) {
    const isEdit = mode === "edit";
    const isCopy = mode === "copy";
    const isEditCopy = mode === "edit_copy";

    const title = isEdit
        ? "Edit book"
        : isEditCopy
          ? "Edit copy"
          : isCopy
            ? "Add copy"
            : "Add a new book";

    const submitLabel = isEdit
        ? "Update book"
        : isEditCopy
          ? "Update copy"
          : isCopy
            ? "Save copy"
            : "Save book";

    return (
        <Dialog modal open={open} onOpenChange={onOpenChange}>
            {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}

            <DialogContent
                className="w-[92vw] max-h-[95svh] overflow-y-auto border-white/10 bg-slate-900 text-white sm:max-w-lg
        [scrollbar-width:thin] [scrollbar-color:#1f2937_transparent]
        [&::-webkit-scrollbar]:w-1.5
        [&::-webkit-scrollbar-track]:bg-slate-900/70
        [&::-webkit-scrollbar-thumb]:rounded-full
        [&::-webkit-scrollbar-thumb]:bg-slate-700
        [&::-webkit-scrollbar-thumb:hover]:bg-slate-600"
            >
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription className="text-white/70">
                        {isEdit ? (
                            <>
                                Update the catalog and physical-copy details for this saved book
                                record.
                            </>
                        ) : isEditCopy ? (
                            <>
                                Update this saved copy. All copy details remain editable, including
                                accession number, barcode, call number, copy number, and the rest
                                of the catalog fields shown below.
                            </>
                        ) : isCopy ? (
                            <>
                                Save another copy record for this title. All fields are editable
                                before saving so each copy can keep its own accession number,
                                barcode, call number, copy number, and other details.
                            </>
                        ) : (
                            <>
                                Save the first physical copy for this title. Use the separate{" "}
                                <span className="font-semibold text-white">Add copy</span>{" "}
                                action later for additional copies with their own accession number,
                                barcode, and copy number.
                            </>
                        )}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-2">
                    <div className="space-y-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-white/70">
                            Cataloging essentials
                        </div>

                        <Field>
                            <FieldLabel className="text-white">Call number *</FieldLabel>
                            <FieldContent>
                                <Input
                                    value={values.callNumber}
                                    onChange={(e) => onChange({ callNumber: e.target.value })}
                                    placeholder={
                                        isEdit || isEditCopy
                                            ? "Required"
                                            : "Required (e.g., QA76.73.J38 M37 2008)"
                                    }
                                    className="border-white/20 bg-slate-900/70 text-white"
                                    autoComplete="off"
                                />
                            </FieldContent>
                        </Field>

                        <Field>
                            <FieldLabel className="text-white">Accession number *</FieldLabel>
                            <FieldContent>
                                <Input
                                    value={values.accessionNumber}
                                    onChange={(e) => onChange({ accessionNumber: e.target.value })}
                                    placeholder="Required"
                                    className="border-white/20 bg-slate-900/70 text-white"
                                    autoComplete="off"
                                />
                            </FieldContent>
                        </Field>

                        <Field>
                            <FieldLabel className="text-white">Title *</FieldLabel>
                            <FieldContent>
                                <Input
                                    value={values.title}
                                    onChange={(e) => onChange({ title: e.target.value })}
                                    placeholder="e.g., Clean Code"
                                    className="border-white/20 bg-slate-900/70 text-white"
                                    autoComplete="off"
                                />
                            </FieldContent>
                        </Field>

                        <Field>
                            <FieldLabel className="text-white">Subtitle</FieldLabel>
                            <FieldContent>
                                <Input
                                    value={values.subtitle}
                                    onChange={(e) => onChange({ subtitle: e.target.value })}
                                    placeholder="Optional"
                                    className="border-white/20 bg-slate-900/70 text-white"
                                    autoComplete="off"
                                />
                            </FieldContent>
                        </Field>

                        <Field>
                            <FieldLabel className="text-white">Publication year *</FieldLabel>
                            <FieldContent>
                                <Input
                                    value={values.pubYear}
                                    onChange={(e) => onChange({ pubYear: e.target.value })}
                                    placeholder="e.g., 2008"
                                    className="border-white/20 bg-slate-900/70 text-white"
                                    inputMode="numeric"
                                    autoComplete="off"
                                />
                            </FieldContent>
                        </Field>

                        <Field>
                            <FieldLabel className="text-white">Author *</FieldLabel>
                            <FieldContent>
                                <Input
                                    value={values.author}
                                    onChange={(e) => onChange({ author: e.target.value })}
                                    placeholder="e.g., Robert C. Martin"
                                    className="border-white/20 bg-slate-900/70 text-white"
                                    autoComplete="off"
                                />
                            </FieldContent>
                        </Field>

                        <Field>
                            <FieldLabel className="text-white">Place of publication *</FieldLabel>
                            <FieldContent>
                                <Input
                                    value={values.placeOfPublication}
                                    onChange={(e) =>
                                        onChange({ placeOfPublication: e.target.value })
                                    }
                                    placeholder={
                                        isEdit || isEditCopy
                                            ? "Required"
                                            : "Required (e.g., Boston)"
                                    }
                                    className="border-white/20 bg-slate-900/70 text-white"
                                    autoComplete="off"
                                />
                            </FieldContent>
                        </Field>

                        <Field>
                            <FieldLabel className="text-white">Publisher *</FieldLabel>
                            <FieldContent>
                                <Input
                                    value={values.publisher}
                                    onChange={(e) => onChange({ publisher: e.target.value })}
                                    placeholder={
                                        isEdit || isEditCopy
                                            ? "Required"
                                            : "Required (e.g., Pearson)"
                                    }
                                    className="border-white/20 bg-slate-900/70 text-white"
                                    autoComplete="off"
                                />
                            </FieldContent>
                        </Field>

                        <Field>
                            <FieldLabel className="text-white">Pages</FieldLabel>
                            <FieldContent>
                                <Input
                                    value={values.pages}
                                    onChange={(e) => onChange({ pages: e.target.value })}
                                    placeholder='Optional (e.g., "200")'
                                    className="border-white/20 bg-slate-900/70 text-white"
                                    autoComplete="off"
                                />
                            </FieldContent>
                            <p className="mt-1 text-[11px] text-white/60">
                                Use a positive number when page count is available.
                            </p>
                        </Field>

                        <Field>
                            <FieldLabel className="text-white">Subjects</FieldLabel>
                            <FieldContent>
                                <Input
                                    value={values.subjects}
                                    onChange={(e) => onChange({ subjects: e.target.value })}
                                    placeholder="Optional (e.g., Software Engineering)"
                                    className="border-white/20 bg-slate-900/70 text-white"
                                    autoComplete="off"
                                />
                            </FieldContent>
                        </Field>

                        <Field>
                            <FieldLabel className="text-white">Other details</FieldLabel>
                            <FieldContent>
                                <Input
                                    value={values.otherDetails}
                                    onChange={(e) => onChange({ otherDetails: e.target.value })}
                                    placeholder="Optional"
                                    className="border-white/20 bg-slate-900/70 text-white"
                                    autoComplete="off"
                                />
                            </FieldContent>
                        </Field>
                    </div>

                    <div className="space-y-4 border-t border-white/10 pt-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-white/70">
                            Additional info
                        </div>

                        <Field>
                            <FieldLabel className="text-white">Barcode *</FieldLabel>
                            <FieldContent>
                                <Input
                                    value={values.barcode}
                                    onChange={(e) => onChange({ barcode: e.target.value })}
                                    placeholder="Required"
                                    className="border-white/20 bg-slate-900/70 text-white"
                                    autoComplete="off"
                                />
                            </FieldContent>
                        </Field>

                        <Field>
                            <FieldLabel className="text-white">ISBN</FieldLabel>
                            <FieldContent>
                                <Input
                                    value={values.isbn}
                                    onChange={(e) => onChange({ isbn: e.target.value })}
                                    placeholder={
                                        isEdit || isEditCopy
                                            ? "Optional"
                                            : "Optional (e.g., 9780132350884)"
                                    }
                                    className="border-white/20 bg-slate-900/70 text-white"
                                    autoComplete="off"
                                />
                            </FieldContent>
                        </Field>

                        <Field>
                            <FieldLabel className="text-white">ISSN</FieldLabel>
                            <FieldContent>
                                <Input
                                    value={values.issn}
                                    onChange={(e) => onChange({ issn: e.target.value })}
                                    placeholder="Optional"
                                    className="border-white/20 bg-slate-900/70 text-white"
                                    autoComplete="off"
                                />
                            </FieldContent>
                        </Field>

                        <Field>
                            <FieldLabel className="text-white">Edition</FieldLabel>
                            <FieldContent>
                                <Input
                                    value={values.edition}
                                    onChange={(e) => onChange({ edition: e.target.value })}
                                    placeholder="Optional"
                                    className="border-white/20 bg-slate-900/70 text-white"
                                    autoComplete="off"
                                />
                            </FieldContent>
                        </Field>

                        <Field>
                            <FieldLabel className="text-white">Dimensions</FieldLabel>
                            <FieldContent>
                                <Input
                                    value={values.dimensions}
                                    onChange={(e) => onChange({ dimensions: e.target.value })}
                                    placeholder="Optional"
                                    className="border-white/20 bg-slate-900/70 text-white"
                                    autoComplete="off"
                                />
                            </FieldContent>
                        </Field>

                        <Field>
                            <FieldLabel className="text-white">Notes</FieldLabel>
                            <FieldContent>
                                <Input
                                    value={values.notes}
                                    onChange={(e) => onChange({ notes: e.target.value })}
                                    placeholder="Optional"
                                    className="border-white/20 bg-slate-900/70 text-white"
                                    autoComplete="off"
                                />
                            </FieldContent>
                        </Field>

                        <Field>
                            <FieldLabel className="text-white">Series</FieldLabel>
                            <FieldContent>
                                <Input
                                    value={values.series}
                                    onChange={(e) => onChange({ series: e.target.value })}
                                    placeholder="Optional"
                                    className="border-white/20 bg-slate-900/70 text-white"
                                    autoComplete="off"
                                />
                            </FieldContent>
                        </Field>

                        <Field>
                            <FieldLabel className="text-white">Added entries</FieldLabel>
                            <FieldContent>
                                <Input
                                    value={values.addedEntries}
                                    onChange={(e) => onChange({ addedEntries: e.target.value })}
                                    placeholder="Optional"
                                    className="border-white/20 bg-slate-900/70 text-white"
                                    autoComplete="off"
                                />
                            </FieldContent>
                        </Field>
                    </div>

                    <div className="space-y-4 border-t border-white/10 pt-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-white/70">
                            Copy & circulation
                        </div>

                        {isEdit || isEditCopy ? (
                            <div className="rounded-md border border-white/10 bg-slate-900/50 px-3 py-2 text-xs text-white/70">
                                <div className="flex flex-wrap gap-x-4 gap-y-1">
                                    <span>
                                        <span className="text-white/50">Total:</span>{" "}
                                        <span className="font-semibold text-white/80">
                                            {typeof inventory?.total === "number"
                                                ? inventory.total
                                                : "—"}
                                        </span>
                                    </span>
                                    <span>
                                        <span className="text-white/50">Borrowed:</span>{" "}
                                        <span className="font-semibold text-white/80">
                                            {typeof inventory?.borrowed === "number"
                                                ? inventory.borrowed
                                                : "—"}
                                        </span>
                                    </span>
                                    <span>
                                        <span className="text-white/50">Remaining:</span>{" "}
                                        <span className="font-semibold text-white/80">
                                            {typeof inventory?.remaining === "number"
                                                ? inventory.remaining
                                                : "—"}
                                        </span>
                                    </span>
                                    <span>
                                        <span className="text-white/50">Active borrows:</span>{" "}
                                        <span className="font-semibold text-white/80">
                                            {typeof inventory?.activeBorrowCount === "number"
                                                ? inventory.activeBorrowCount
                                                : "—"}
                                        </span>
                                    </span>
                                    <span>
                                        <span className="text-white/50">Borrowed all-time:</span>{" "}
                                        <span className="font-semibold text-white/80">
                                            {typeof inventory?.totalBorrowCount === "number"
                                                ? inventory.totalBorrowCount
                                                : "—"}
                                        </span>
                                    </span>
                                </div>
                            </div>
                        ) : null}

                        <div className="rounded-md border border-cyan-400/20 bg-cyan-500/10 px-3 py-3 text-[11px] leading-5 text-cyan-100/85">
                            {isCopy ? (
                                <>
                                    This creates a separate saved copy record. Every visible field
                                    here is editable before saving.
                                </>
                            ) : isEditCopy ? (
                                <>
                                    This updates a saved copy record. You can edit the copy number,
                                    accession number, barcode, and the rest of the copy details
                                    from this dialog.
                                </>
                            ) : (
                                <>
                                    Each saved record represents one physical copy. Use the
                                    separate <span className="font-semibold text-cyan-100">Add copy</span>{" "}
                                    action from an existing record when you need another copy with a
                                    different accession number, barcode, and copy number.
                                </>
                            )}
                        </div>

                        <Field>
                            <FieldLabel className="text-white">Copy number *</FieldLabel>
                            <FieldContent>
                                <Input
                                    value={values.copyNumber}
                                    onChange={(e) => onChange({ copyNumber: e.target.value })}
                                    placeholder="Required (positive number)"
                                    className="border-white/20 bg-slate-900/70 text-white"
                                    inputMode="numeric"
                                    autoComplete="off"
                                />
                            </FieldContent>
                            <p className="mt-1 text-[11px] text-white/60">
                                Required for every physical copy of the book.
                            </p>
                        </Field>

                        <Field>
                            <FieldLabel className="text-white">Volume number</FieldLabel>
                            <FieldContent>
                                <Input
                                    value={values.volumeNumber}
                                    onChange={(e) => onChange({ volumeNumber: e.target.value })}
                                    placeholder="Optional"
                                    className="border-white/20 bg-slate-900/70 text-white"
                                    autoComplete="off"
                                />
                            </FieldContent>
                        </Field>

                        <Field>
                            <FieldLabel className="text-white">Library area *</FieldLabel>
                            <FieldContent>
                                <RadioGroup
                                    value={values.libraryAreaOption}
                                    onValueChange={(v) => {
                                        onChange({
                                            libraryAreaOption: v,
                                            libraryAreaOther:
                                                v === LIBRARY_AREA_OTHER_VALUE
                                                    ? values.libraryAreaOther
                                                    : "",
                                        });
                                    }}
                                    className="space-y-2"
                                >
                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                        {LIBRARY_AREA_OPTIONS.map((opt) => {
                                            const id = `${mode}-lib-area-${opt}`;

                                            return (
                                                <div
                                                    key={opt}
                                                    className="flex items-center gap-2 rounded-md border border-white/10 bg-slate-900/50 px-3 py-2"
                                                >
                                                    <RadioGroupItem value={opt} id={id} />
                                                    <Label
                                                        htmlFor={id}
                                                        className="cursor-pointer text-sm text-white/80"
                                                    >
                                                        {formatLibraryAreaLabel(opt)}
                                                    </Label>
                                                </div>
                                            );
                                        })}

                                        <div className="flex items-center gap-2 rounded-md border border-white/10 bg-slate-900/50 px-3 py-2">
                                            <RadioGroupItem
                                                value={LIBRARY_AREA_OTHER_VALUE}
                                                id={`${mode}-lib-area-others`}
                                            />
                                            <Label
                                                htmlFor={`${mode}-lib-area-others`}
                                                className="cursor-pointer text-sm text-white/80"
                                            >
                                                Others (please specify)
                                            </Label>
                                        </div>
                                    </div>

                                    {values.libraryAreaOption === LIBRARY_AREA_OTHER_VALUE ? (
                                        <div className="pt-2">
                                            <Input
                                                value={values.libraryAreaOther}
                                                onChange={(e) =>
                                                    onChange({
                                                        libraryAreaOther: e.target.value,
                                                    })
                                                }
                                                placeholder="Please specify (e.g., archives)"
                                                className="border-white/20 bg-slate-900/70 text-white"
                                                autoComplete="off"
                                            />
                                        </div>
                                    ) : null}
                                </RadioGroup>
                            </FieldContent>
                        </Field>

                        <Field>
                            <FieldLabel className="text-white">
                                Default borrow duration (days) *
                            </FieldLabel>
                            <FieldContent>
                                <Input
                                    value={values.borrowDuration}
                                    onChange={(e) => onChange({ borrowDuration: e.target.value })}
                                    placeholder="e.g., 7"
                                    className="border-white/20 bg-slate-900/70 text-white"
                                    inputMode="numeric"
                                    autoComplete="off"
                                />
                            </FieldContent>
                            <p className="mt-1 text-[11px] text-white/60">
                                This controls how many days a student can initially borrow this
                                copy.
                            </p>
                        </Field>

                        <div className="rounded-md border border-amber-400/20 bg-amber-500/10 px-3 py-3">
                            <div className="flex items-start gap-2">
                                <Checkbox
                                    id={`${mode}-library-use-only`}
                                    checked={values.isLibraryUseOnly}
                                    onCheckedChange={(v) =>
                                        onChange({ isLibraryUseOnly: v === true })
                                    }
                                />
                                <div className="space-y-1">
                                    <Label
                                        htmlFor={`${mode}-library-use-only`}
                                        className="cursor-pointer text-sm font-medium text-amber-100"
                                    >
                                        Library Use Only
                                    </Label>
                                    <p className="text-[11px] leading-5 text-amber-100/80">
                                        Keep this copy visible in catalog lists and choices, but do
                                        not allow it to be borrowed.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                            <Checkbox
                                id={`${mode}-available`}
                                checked={values.available}
                                onCheckedChange={(v) => onChange({ available: v === true })}
                            />
                            <Label
                                htmlFor={`${mode}-available`}
                                className="text-sm text-white/80"
                            >
                                Show as available in the catalog
                            </Label>
                        </div>

                        {values.isLibraryUseOnly ? (
                            <p className="text-[11px] text-amber-200/90">
                                Borrowing is disabled for this copy. It will still appear in
                                selections with the <span className="font-semibold">Library Use Only</span>{" "}
                                label.
                            </p>
                        ) : null}

                        {error ? <FieldError>{error}</FieldError> : null}
                    </div>
                </div>

                <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button
                        type="button"
                        variant="outline"
                        className="w-full border-white/20 text-white hover:bg-black/10 hover:text-white sm:w-auto"
                        onClick={onCancel}
                        disabled={submitting}
                    >
                        Cancel
                    </Button>

                    <Button
                        type="button"
                        className="w-full cursor-pointer bg-linear-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 sm:w-auto"
                        onClick={onSubmit}
                        disabled={submitting}
                    >
                        {submitting ? (
                            <span className="inline-flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Saving…
                            </span>
                        ) : (
                            submitLabel
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
