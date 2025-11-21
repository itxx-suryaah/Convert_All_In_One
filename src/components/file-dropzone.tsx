"use client";

import { useState, useRef, type DragEvent, type ChangeEvent } from "react";
import { UploadCloud, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type FileDropzoneProps = {
  onFilesAdded: (files: File[]) => void;
  multiple?: boolean;
  accept?: string;
  className?: string;
  allowDirectories?: boolean;
  maxFiles?: number;
};

const defaultAccept =
  "image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip";

export function FileDropzone({
  onFilesAdded,
  multiple = false,
  accept,
  className,
  allowDirectories = false,
  maxFiles,
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const validateAndAddFiles = (files: File[]) => {
    if (maxFiles && files.length > maxFiles) {
      toast({
        variant: "destructive",
        title: "Too many files",
        description: `You can only upload up to ${maxFiles} files at once.`,
      });
      return;
    }
    onFilesAdded(files);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      validateAndAddFiles(droppedFiles);
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      validateAndAddFiles(files);
    }
    // Reset input to allow selecting the same file again
    e.target.value = "";
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFolderClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    folderInputRef.current?.click();
  };

  return (
    <div
      onClick={handleClick}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={cn(
        "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border/50 bg-card/30 p-12 text-center transition-colors duration-200 backdrop-blur-sm cursor-pointer",
        isDragging ? "border-primary bg-accent/50" : "hover:border-primary/50",
        className
      )}
    >
      {/* Standard File Input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple={multiple}
        accept={accept || defaultAccept}
        onChange={handleFileSelect}
      />

      {/* Folder Input - Hidden and separate to avoid conflicts */}
      {allowDirectories && (
        <input
          ref={folderInputRef}
          type="file"
          className="hidden"
          // @ts-expect-error webkitdirectory is non-standard but supported in Chrome/Edge/Firefox
          webkitdirectory=""
          directory=""
          multiple
          onChange={handleFileSelect}
        />
      )}

      <div className="flex flex-col items-center gap-4 text-muted-foreground pointer-events-none">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white shadow-lg">
          <UploadCloud className="h-8 w-8" />
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-foreground text-lg">
            {allowDirectories
              ? "Drop files or folders here"
              : "Drop your files here"}
          </p>
          <p className="text-sm">or click to browse</p>
        </div>

        {allowDirectories && (
          <div className="mt-2 pointer-events-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleFolderClick}
              className="inline-flex items-center gap-2 hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              <FolderOpen className="h-4 w-4" />
              Select Folder
            </Button>
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-2 mt-4 opacity-60">
          {allowDirectories ? (
            <>
              <span className="text-[10px] font-medium border border-border rounded-full px-2 py-0.5">
                IMAGES
              </span>
              <span className="text-[10px] font-medium border border-border rounded-full px-2 py-0.5">
                PDF
              </span>
              <span className="text-[10px] font-medium border border-border rounded-full px-2 py-0.5">
                DOCS
              </span>
            </>
          ) : (
            <>
              <span className="text-[10px] font-medium border border-border rounded-full px-2 py-0.5">
                JPG
              </span>
              <span className="text-[10px] font-medium border border-border rounded-full px-2 py-0.5">
                PNG
              </span>
              <span className="text-[10px] font-medium border border-border rounded-full px-2 py-0.5">
                WEBP
              </span>
              <span className="text-[10px] font-medium border border-border rounded-full px-2 py-0.5">
                PDF
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
