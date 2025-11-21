"use client";

import { useState } from "react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { ToolHeader } from "@/components/tool-header";
import { FileDropzone } from "@/components/file-dropzone";
import { TOOLS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FolderSync, Trash2, X, File as FileIcon, Settings, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import imageCompression from "browser-image-compression";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type FileItem = {
  id: string;
  file: File;
  name: string;
  relativePath: string;
};

function SortableRow({ item, onRemove, onRename }: { item: FileItem; onRemove: (id: string) => void; onRename: (id: string, name: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition };
  const baseName = item.name.split('.').slice(0, -1).join('');
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-4 p-2 rounded-md bg-card hover:bg-muted/50">
      <div {...attributes} {...listeners} className="cursor-grab select-none text-muted-foreground">⋮⋮</div>
      <FileIcon className="h-6 w-6 text-muted-foreground" />
      <div className="grow">
        <Input
          value={baseName}
          onChange={(e) => onRename(item.id, e.target.value)}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground mt-1 truncate">{item.relativePath}</p>
      </div>
      <span className="text-sm text-muted-foreground whitespace-nowrap">{(item.file.size / 1024).toFixed(1)} KB</span>
      <Button variant="ghost" size="icon" onClick={() => onRemove(item.id)}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}

const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB

export default function CompressFolderPage() {
  const tool = TOOLS.find((t) => t.href === "/compress-folder")!;
  const [files, setFiles] = useState<FileItem[]>([]);
  const [renamePattern, setRenamePattern] = useState("image-{n}");
  const [quality, setQuality] = useState(80);
  const [zipFileName, setZipFileName] = useState("compressed-folder");
  const { toast } = useToast();
  const [isCompressing, setIsCompressing] = useState(false);

  const handleFilesAdded = (newFiles: File[]) => {
    const totalSize = files.reduce((acc, item) => acc + item.file.size, 0) + newFiles.reduce((acc, file) => acc + file.size, 0);

    if (totalSize > MAX_TOTAL_SIZE) {
        toast({
            variant: 'destructive',
            title: 'Upload limit exceeded',
            description: `The total folder size cannot exceed 50MB.`
        });
        return;
    }
    
    const newFileItems = newFiles.map((file, i) => ({
      id: `${file.name}-${Date.now()}-${i}`,
      file,
      name: file.name,
      // @ts-ignore - webkitRelativePath is non-standard but available
      relativePath: file.webkitRelativePath || file.name,
    }));

    setFiles((prev) => [...prev, ...newFileItems].sort((a, b) => a.relativePath.localeCompare(b.relativePath)));
  };
  
  const handleRemoveFile = (id: string) => {
    setFiles(files.filter(f => f.id !== id));
  }

  const handleBulkRename = () => {
    // const imageFiles = files.filter(item => item.file.type.startsWith('image/')); // Unused
    let imageCounter = 0;
    setFiles(
      files.map((item) => {
        if (item.file.type.startsWith('image/')) {
          imageCounter++;
          const extension = item.name.split('.').pop() || 'jpg';
          const newName = `${renamePattern.replace("{n}", String(imageCounter))}`;
          
          // Update relativePath with new name
          const pathParts = item.relativePath.split('/');
          pathParts[pathParts.length - 1] = `${newName}.${extension}`;
          
          return {
            ...item,
            name: newName,
            relativePath: pathParts.join('/'),
          }
        }
        return item;
      })
    );
  };

  const handleNameChange = (id: string, newName: string) => {
    setFiles(
      files.map((item) => (item.id === id ? { ...item, name: newName } : item))
    );
  };

  const handleDownloadZip = async () => {
    if (!files.length) return;
    setIsCompressing(true);
    toast({ title: "Compressing folder...", description: `Processing ${files.length} files. Please wait.` });

    try {
        const zip = new JSZip();
        
        for (const item of files) {
            let fileToAdd: Blob | File = item.file;
            let fileName = item.relativePath || item.name;

            // Ensure the name from the input field is used if changed
            const pathParts = fileName.split('/');
            const currentNameInPath = pathParts[pathParts.length - 1];
            const nameWithoutExt = currentNameInPath.split('.').slice(0, -1).join('.');
            
            // Reconstruct name to handle individual and bulk renames
            if(item.name !== nameWithoutExt) {
                const extension = currentNameInPath.split('.').pop() || '';
                pathParts[pathParts.length - 1] = item.name + (extension ? `.${extension}` : '');
                fileName = pathParts.join('/');
            }


            if (item.file.type.startsWith('image/')) {
                const extension = 'jpeg'; // Defaulting to jpeg as output format is removed
                // Adjust filename in path to have the new extension
                const baseName = fileName.substring(0, fileName.lastIndexOf('.'));
                fileName = `${baseName}.${extension}`;

                try {
                    const options = {
                        maxSizeMB: 2, // Reasonable default for folder compression
                        maxWidthOrHeight: 1920,
                        useWebWorker: true,
                        fileType: `image/${extension}`,
                        initialQuality: quality / 100,
                    };
                    const compressedBlob = await imageCompression(item.file, options);
                    if (compressedBlob) {
                        fileToAdd = compressedBlob;
                    }
                } catch (error) {
                    console.error(`Failed to compress ${item.file.name}:`, error);
                    // Add original file if compression fails
                }
            }
            zip.file(fileName, fileToAdd);
        }

        const zipBlob = await zip.generateAsync({ type: "blob" });
        saveAs(zipBlob, `${zipFileName}.zip`);
        // Use default toast variant for success messages
        toast({ title: "Compression complete!", description: "Your ZIP file has been downloaded." });
    } catch (error) {
        console.error("Error creating ZIP file:", error);
        toast({ variant: 'destructive', title: "Error", description: "Could not create the ZIP file." });
    } finally {
        setIsCompressing(false);
    }
}
  
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setFiles((prev) => {
      const oldIndex = prev.findIndex((f) => f.id === String(active.id));
      const newIndex = prev.findIndex((f) => f.id === String(over.id));
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const handleClearAll = () => {
      setFiles([]);
  }

  const totalOriginalSize = files.reduce((acc, f) => acc + f.file.size, 0);
  const totalCompressedSize = totalOriginalSize * (quality / 100);
  const totalSaved = totalOriginalSize > 0 ? ((totalOriginalSize - totalCompressedSize) / totalOriginalSize) * 100 : 0;

  return (
    <div className="w-full px-2 sm:px-3 md:px-4">
      <ToolHeader title={tool.name} description={tool.description} />
      {!files.length ? (
        <>
          <FileDropzone
            onFilesAdded={handleFilesAdded}
            multiple
            allowDirectories
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.iso"
            className="p-6 sm:p-10 min-h-[120px] sm:min-h-[180px] max-w-md sm:max-w-2xl lg:max-w-3xl mx-auto"
          />
          <p className="mt-3 text-center text-xs text-muted-foreground px-4">
            Note: Max total size 50MB. Folder selection may not be supported on some mobile browsers. If it isn’t available, select multiple files instead.
          </p>
        </>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="order-2 lg:order-1 lg:col-span-8 space-y-3">
             <div className="flex justify-between items-center">
                <h3 className="font-headline text-xl font-semibold">Files ({files.length})</h3>
                <Button variant="outline" onClick={handleClearAll}>
                  <X className="mr-2 h-4 w-4" /> Clear All
                </Button>
            </div>
            <Card>
                <CardContent className="p-4 space-y-2 max-h-[40vh] md:max-h-[50vh] lg:max-h-[60vh] overflow-y-auto">
                  <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={files.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                      {files.map((item) => (
                        <SortableRow
                          key={item.id}
                          item={item}
                          onRemove={handleRemoveFile}
                          onRename={handleNameChange}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                </CardContent>
            </Card>
          </div>
          <div className="order-1 lg:order-2 lg:col-span-4 w-full lg:w-[400px] space-y-5 lg:sticky lg:top-24">
            <Card>
              <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Settings className="w-5 h-5"/>Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label htmlFor="quality-slider">Folder Quality: {quality}</Label>
                  <Slider
                    id="quality-slider"
                    min={0}
                    max={100}
                    step={1}
                    value={[quality]}
                    onValueChange={(value) => setQuality(value[0])}
                  />
                </div>
                 <div className="space-y-4">
                  <div>
                    <Label htmlFor="rename-pattern">Folder Rename</Label>
                    <Input
                      id="rename-pattern"
                      value={renamePattern}
                      onChange={(e) => setRenamePattern(e.target.value)}
                      placeholder="e.g. new-name-{n}"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Use {'{n}'} for the file number.
                    </p>
                  </div>
                  <Button onClick={handleBulkRename} variant="outline" className="w-full">
                    Apply Pattern
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-4 text-center mt-4 p-4 rounded-lg bg-black/85 text-white">
                    <div>
                        <p className="text-sm text-muted-foreground">Total Original</p>
                        <p className="text-lg font-bold">{(totalOriginalSize / (1024*1024)).toFixed(2)} MB</p>
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground">Est. Compressed</p>
                        <p className="text-lg font-bold">{(totalCompressedSize / (1024*1024)).toFixed(2)} MB</p>
                    </div>
                     <div>
                        <p className="text-sm text-muted-foreground">Est. Saved</p>
                        <div className="flex items-center justify-center gap-2">
                            <Badge variant="gradient" className="text-lg">{totalSaved.toFixed(0)}%</Badge>
                        </div>
                    </div>
                </div>
                
                <div>
                    <Label htmlFor="zip-filename">Download Folder Name</Label>
                    <Input
                      id="zip-filename"
                      value={zipFileName}
                      onChange={(e) => setZipFileName(e.target.value)}
                      placeholder="Enter folder name"
                    />
                </div>

                <Button className="w-full bg-black/85 text-white" onClick={handleDownloadZip} disabled={isCompressing}>
                    {isCompressing ? <Loader2 className="animate-spin mr-2"/> : <FolderSync className="mr-2 h-4 w-4"/>}
                    {isCompressing ? 'Compressing...' : 'Compress & Download ZIP'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}