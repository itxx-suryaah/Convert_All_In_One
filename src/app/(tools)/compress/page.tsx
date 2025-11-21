"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Download, Loader2, X, Settings } from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import imageCompression from "browser-image-compression";

import { ToolHeader } from "../../../components/tool-header";
import { FileDropzone } from "../../../components/file-dropzone";
import { TOOLS } from "../../../lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Slider } from "../../../components/ui/slider";
import { Label } from "../../../components/ui/label";
import { Button } from "../../../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { Badge } from "../../../components/ui/badge";
import { Input } from "../../../components/ui/input";
import { useToast } from "../../../hooks/use-toast";

type ProcessedFile = {
  id: string;
  file: File;
  previewUrl: string;
  originalSize: number;
  compressedSize: number;
  quality: number;
  outputFormat: string;
  outputName: string;
  compressedBlob?: Blob;
};

export default function CompressPage() {
  const tool = TOOLS.find((t) => t.href === "/compress")!;
  const [files, setFiles] = useState<File[]>([]);
  const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([]);
  const [quality, setQuality] = useState(80);
  const [outputFormat, setOutputFormat] = useState("jpeg");
  const [isCompressing, setIsCompressing] = useState(false);
  const { toast } = useToast();

  const handleFileAdded = (newFiles: File[]) => {
    setFiles((prevFiles) => [...prevFiles, ...newFiles]);
  };
  
  useEffect(() => {
    const processFiles = async () => {
        if (files.length === 0) {
            processedFiles.forEach(f => URL.revokeObjectURL(f.previewUrl));
            setProcessedFiles([]);
            return;
        }
        
        // We only want to process new files or re-process if settings change significantly
        // For now, let's just map them and estimate size, actual compression happens on download
        // OR we can compress previews. Compressing on the fly might be slow for many files.
        // Let's do a "preview" compression or just estimate.
        // Actually, browser-image-compression is fast enough for single files, but for many it might lag.
        // Let's just show original vs estimated.
        
        setProcessedFiles(currentProcessed => {
            const fileMap = new Map(currentProcessed.map(f => [f.file.name, f]));
    
            return files.map(file => {
              const existing = fileMap.get(file.name);
              // Simple estimation for UI feedback before actual compression
              const estimatedSize = (file.size) * (quality / 100); 
              const nameWithoutExtension = file.name.split('.').slice(0, -1).join('.');
    
              return {
                id: existing?.id || `${file.name}-${Date.now()}`,
                file,
                previewUrl: existing?.previewUrl || URL.createObjectURL(file),
                originalSize: file.size,
                compressedSize: estimatedSize, // This is just an estimate until we actually compress
                quality,
                outputFormat,
                outputName: existing?.outputName || nameWithoutExtension || 'compressed-image',
              };
            });
          });
    };

    processFiles();
    
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, quality, outputFormat]);


  const handleOutputNameChange = (id: string, newName: string) => {
    setProcessedFiles(prev => 
      prev.map(pf => pf.id === id ? { ...pf, outputName: newName } : pf)
    );
  };

  const totalOriginalSize = processedFiles.reduce((acc, f) => acc + f.originalSize, 0);
  const totalCompressedSize = processedFiles.reduce((acc, f) => acc + f.compressedSize, 0);
  const totalSaved = totalOriginalSize > 0 ? ((totalOriginalSize - totalCompressedSize) / totalOriginalSize) * 100 : 0;


  const handleDownload = async () => {
    if (processedFiles.length === 0) return;
    setIsCompressing(true);
    toast({ title: "Compressing images...", description: `Processing ${processedFiles.length} files. Please wait.` });

    try {
        const compressedBlobs: { name: string, blob: Blob }[] = [];

        for (const pFile of processedFiles) {
            const options = {
                maxSizeMB: 1, // Default max size, maybe expose this?
                maxWidthOrHeight: 1920, // Limit dimensions for better compression
                useWebWorker: true,
                fileType: `image/${outputFormat}` as string,
                initialQuality: quality / 100,
            };
            
            // If the user selected a format different from original, we might need to handle conversion
            // browser-image-compression handles this via fileType
            
            try {
                const compressedFile = await imageCompression(pFile.file, options);
                compressedBlobs.push({ 
                    name: `${pFile.outputName}.${outputFormat === 'jpeg' ? 'jpg' : outputFormat}`, 
                    blob: compressedFile 
                });
            } catch (err) {
                console.error(`Error compressing ${pFile.file.name}`, err);
                toast({ variant: "destructive", title: "Compression Failed", description: `Could not compress ${pFile.file.name}` });
            }
        }

        if (compressedBlobs.length === 1) {
            saveAs(compressedBlobs[0].blob, compressedBlobs[0].name);
            toast({ title: "Compression complete!", description: "Your image has been downloaded." });
        } else if (compressedBlobs.length > 1) {
            const zip = new JSZip();
            compressedBlobs.forEach(item => {
                zip.file(item.name, item.blob);
            });
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            saveAs(zipBlob, 'compressed-images.zip');
            toast({ title: "Compression complete!", description: "Your ZIP file has been downloaded." });
        }
        
    } catch (error) {
        console.error("Error during compression:", error);
        toast({ variant: 'destructive', title: "Error", description: "Could not compress and download the files." });
    } finally {
        setIsCompressing(false);
    }
  };

  const handleClearAll = () => {
    setFiles([]);
    setProcessedFiles([]);
  };
  
  const handleRemoveFile = (fileName: string) => {
    setFiles(files.filter(f => f.name !== fileName));
  };


  return (
    <div className="w-full">
      <ToolHeader title={tool.name} description={tool.description} />
      {processedFiles.length === 0 ? (
        <>
          <FileDropzone
            onFilesAdded={handleFileAdded}
            multiple
            maxFiles={20}
            className="p-4 sm:p-10 min-h-[120px] sm:min-h-[180px] max-w-md sm:max-w-2xl lg:max-w-3xl mx-auto"
          />
          <p className="mt-3 text-center text-xs text-muted-foreground px-4">
            Max 20 files. Max 50MB per file. Some mobile browsers may have limited support.
          </p>
        </>
      ) : (
        <div className="space-y-8">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
                {processedFiles.map((p) => (
                    <Card key={p.id} className="group relative h-full">
                        <CardContent className="p-0">
                            <div className="aspect-square relative">
                                <Image
                                  src={p.previewUrl}
                                  alt={p.file.name}
                                  fill
                                  sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
                                  className="object-cover rounded-t-lg"
                                />
                            </div>
                            <div className="p-3 text-xs">
                                <p className="font-semibold truncate">{p.file.name}</p>
                                <p className="text-muted-foreground">
                                    <span className="line-through">{(p.originalSize / 1024).toFixed(1)} KB</span>
                                    <span className="font-bold text-foreground"> ~{(p.compressedSize / 1024).toFixed(1)} KB</span>
                                </p>
                            </div>
                             <Button
                                variant="destructive"
                                size="icon"
                                className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleRemoveFile(p.file.name)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                        </CardContent>
                    </Card>
                ))}
                 <FileDropzone
                   onFilesAdded={handleFileAdded}
                   multiple
                   maxFiles={20}
                   className="p-4 sm:p-6 min-h-[100px] sm:min-h-[140px]"
                 />
            </div>

            <Card>
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Settings className="w-5 h-5"/>
                    <CardTitle className="text-lg">Compression Settings</CardTitle>
                    <Badge variant="secondary" className="ml-2">{processedFiles.length} completed</Badge>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                    <Button
                      variant="success"
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={handleDownload}
                      disabled={isCompressing}
                    >
                        {isCompressing ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Download className="w-4 h-4 mr-2"/>}
                        {isCompressing ? 'Compressing...' : 'Download All'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full sm:w-auto border-2"
                      onClick={handleClearAll}
                      disabled={isCompressing}
                    >
                      <X className="w-4 h-4 mr-2"/>
                      Clear All
                    </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                    <div>
                        <Label htmlFor="output-format">Output Format</Label>
                        <Select
                          value={outputFormat}
                          onValueChange={setOutputFormat}
                        >
                          <SelectTrigger id="output-format" className="bg-muted/50">
                            <SelectValue placeholder="Select format" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="jpeg">JPEG</SelectItem>
                            <SelectItem value="png">PNG</SelectItem>
                            <SelectItem value="webp">WebP</SelectItem>
                          </SelectContent>
                        </Select>
                    </div>
                    <div>
                      <Label htmlFor="quality-slider">Quality: {quality}</Label>
                      <Slider
                        id="quality-slider"
                        min={0}
                        max={100}
                        step={1}
                        value={[quality]}
                        onValueChange={(value) => setQuality(value[0])}
                      />
                  </div>
                </div>

                {processedFiles.length === 1 && (
                  <div>
                    <Label htmlFor="rename-file">Rename File</Label>
                    <Input
                      id="rename-file"
                      value={processedFiles[0].outputName}
                      onChange={(e) => handleOutputNameChange(processedFiles[0].id, e.target.value)}
                      placeholder="Enter new filename"
                    />
                  </div>
                )}
                
                <div className="grid grid-cols-3 gap-4 text-center mt-4 p-4 rounded-lg bg-blue-950/50">
                    <div>
                        <p className="text-sm text-muted-foreground">Total Original</p>
                        <p className="text-lg font-bold">{(totalOriginalSize / 1024).toFixed(2)} KB</p>
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground">Est. Compressed</p>
                        <p className="text-lg font-bold">~{(totalCompressedSize / 1024).toFixed(2)} KB</p>
                    </div>
                     <div>
                        <p className="text-sm text-muted-foreground">Est. Saved</p>
                        <div className="flex items-center justify-center gap-2">
                            <Badge variant="gradient" className="text-lg">{totalSaved.toFixed(0)}%</Badge>
                        </div>
                    </div>
                </div>
              </CardContent>
            </Card>
        </div>
      )}
    </div>
  );
}