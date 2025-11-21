
"use client";

import { useState } from "react";
import { ToolHeader } from "@/components/tool-header";
import { FileDropzone } from "@/components/file-dropzone";
import { TOOLS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FolderGit2, Trash2, X, File as FileIcon, Loader2 } from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";


type FileItem = {
  id: string;
  file: File;
  name: string;
  relativePath: string;
};

const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB

function SortableRow({ item, onRemove, onRename }: { item: FileItem; onRemove: (id: string) => void; onRename: (id: string, name: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition };
  const baseName = item.name.split('.').slice(0, -1).join('.');
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-4 p-2 rounded-md bg-card hover:bg-muted/50">
      <div {...attributes} {...listeners} className="cursor-grab select-none text-muted-foreground">⋮⋮</div>
      <FileIcon className="h-6 w-6 text-muted-foreground" />
      <div className="flex-grow">
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

export default function ConvertFolderPage() {
  const tool = TOOLS.find((t) => t.href === "/convert-folder")!;
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const [outputFormat, setOutputFormat] = useState("zip");
  const [zipFileName, setZipFileName] = useState("converted-folder");

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
     
      relativePath: file.webkitRelativePath || file.name,
    }));
    setFiles((prev) => [...prev, ...newFileItems].sort((a,b) => a.relativePath.localeCompare(b.relativePath)));
  };
  
  const handleRemoveFile = (id: string) => {
    setFiles(files.filter(f => f.id !== id));
  }

  const handleNameChange = (id: string, newName: string) => {
    setFiles(
      files.map((item) => {
        if (item.id === id) {
            const pathParts = item.relativePath.split('/');
            const extension = item.name.split('.').pop() || '';
            const newFileName = `${newName}${extension ? `.${extension}` : ''}`;
            pathParts[pathParts.length - 1] = newFileName;
            return { ...item, name: newFileName, relativePath: pathParts.join('/') };
        }
        return item;
      })
    );
  };
  
  const handleDownloadZip = async () => {
    if (!files.length) return;
    setIsProcessing(true);
    toast({
      title: "Processing folder...",
      description: `Packaging ${files.length} files. This may take a moment.`,
    });

    try {
      const zip = new JSZip();
      for (const item of files) {
        zip.file(item.relativePath, item.file);
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      saveAs(zipBlob, `${zipFileName}.${outputFormat}`);

      toast({
        title: "Download Ready!",
        description: `Your folder has been packaged as a .${outputFormat} file.`,    
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not process and package the folder.",
      });
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

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
            Note: Folder selection may not be supported on some mobile browsers. If it isn’t available, select multiple files instead.
          </p>
        </>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="order-2 lg:order-1 lg:col-span-8 space-y-3">
             <div className="flex justify-between items-center">
                <h3 className="font-headline text-xl font-semibold">Files ({files.length})</h3>
                <Button variant="outline" onClick={() => setFiles([])}>
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
              <CardHeader className="p-4 ">
                  <CardTitle>Conversion & Download</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-4">
                <p className="text-sm text-muted-foreground">This tool will package all uploaded files and folders into a single archive for download.</p>
                <div>
                  <Label htmlFor="format-select">Convert To</Label>
                  <Select
                    value={outputFormat}
                    onValueChange={setOutputFormat}
                    disabled={!files.length || isProcessing}
                  >
                    <SelectTrigger id="format-select">
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="zip">ZIP</SelectItem>
                      <SelectItem value="pdf">PDF</SelectItem>
                      <SelectItem value="iso">ISO</SelectItem>
                      <SelectItem value="rar">RAR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="zip-filename">Download File Name</Label>
                  <Input
                    id="zip-filename"
                    value={zipFileName}
                    onChange={(e) => setZipFileName(e.target.value)}
                    placeholder="Enter file name"
                    disabled={isProcessing}
                  />
                </div>
                <Button className="w-full bg-black/85 text-white" onClick={handleDownloadZip} disabled={isProcessing}>
                  {isProcessing ? <Loader2 className="animate-spin mr-2"/> : <FolderGit2 className="mr-2 h-4 w-4"/>}
                  {isProcessing ? 'Packaging...' : 'Convert & Download'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
