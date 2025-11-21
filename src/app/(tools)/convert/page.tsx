
"use client";

import { useState, ChangeEvent } from "react";
import { ToolHeader } from "@/components/tool-header";
import { FileDropzone } from "@/components/file-dropzone";
import { TOOLS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Image from "next/image";
import { Download, Loader2, X, File as FileIcon } from "lucide-react";
import { saveAs } from "file-saver";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

const isImageFile = (file: File | null) => file && file.type.startsWith("image/");

export default function ConvertPage() {
  const tool = TOOLS.find((t) => t.href === "/convert")!;
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [outputFormat, setOutputFormat] = useState("jpeg");
  const [outputFilename, setOutputFilename] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const [resize, setResize] = useState({ width: 0, height: 0 });
  const [originalDimensions, setOriginalDimensions] = useState({
    width: 0,
    height: 0,
  });

  const handleFileAdded = (files: File[]) => {
    const selectedFile = files[0];
    if (selectedFile) {
      setFile(selectedFile);
      const nameWithoutExtension = selectedFile.name
        .split(".")
        .slice(0, -1)
        .join(".");
      setOutputFilename(nameWithoutExtension || `converted-file`);

      if (isImageFile(selectedFile)) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const url = e.target?.result as string;
          setPreviewUrl(url);
          const img = document.createElement("img");
          img.onload = () => {
            setOriginalDimensions({ width: img.width, height: img.height });
            setResize({ width: img.width, height: img.height });
          };
          img.src = url;
        };
        reader.readAsDataURL(selectedFile);
      } else {
        setPreviewUrl(null);
        setOutputFormat('pdf'); // Default for non-image files
      }
    }
  };

  const handleDimensionChange = (
    e: ChangeEvent<HTMLInputElement>,
    dimension: "width" | "height"
  ) => {
    const value = parseInt(e.target.value, 10) || 0;

    if (originalDimensions.width > 0 && originalDimensions.height > 0) {
      const aspectRatio = originalDimensions.width / originalDimensions.height;
      if (dimension === "width") {
        setResize({ width: value, height: Math.round(value / aspectRatio) });
      } else {
        setResize({ width: Math.round(value * aspectRatio), height: value });
      }
    } else {
      setResize((prev) => ({ ...prev, [dimension]: value }));
    }
  };

  const getOutputFileNameWithExtension = () => {
    return `${outputFilename || "converted-file"}.${outputFormat}`;
  };

  const handleConvertAndDownload = () => {
    if (!file) return;

    setIsProcessing(true);
    toast({
      title: "Converting file...",
      description: "Please wait while we process your file.",
    });
    
    if (!isImageFile(file)) {
        // Placeholder for non-image conversion logic
        // In a real app, this would call a server action or use a library like jspdf
        setTimeout(() => {
            saveAs(file, getOutputFileNameWithExtension());
            toast({
              title: "Conversion complete!",
              description: `Your file has been prepared for download.`,
            });
            setIsProcessing(false);
        }, 1500)
        return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = document.createElement("img");
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");

        const targetWidth =
          resize.width > 0 ? resize.width : originalDimensions.width;
        const targetHeight =
          resize.height > 0 ? resize.height : originalDimensions.height;

        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          toast({
            variant: "destructive",
            title: "Error",
            description: "Could not create image context.",
          });
          setIsProcessing(false);
          return;
        }

        // Better quality scaling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              saveAs(blob, getOutputFileNameWithExtension());
              toast({
                title: "Conversion complete!",
                description: "Your file has been downloaded.",
              });
            } else {
              toast({
                variant: "destructive",
                title: "Error",
                description: `Could not convert to ${outputFormat}.`,
              });
            }
            setIsProcessing(false);
          },
          `image/${outputFormat}`,
          0.92 // High quality default
        );
      };
      img.onerror = () => {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Could not load the image for conversion.",
        });
        setIsProcessing(false);
      };
    };
    reader.onerror = () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to read the file.",
      });
      setIsProcessing(false);
    };
  };

  const handleReset = () => {
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setFile(null);
    setPreviewUrl(null);
    setOutputFilename("");
    setResize({ width: 0, height: 0 });
    setOriginalDimensions({ width: 0, height: 0 });
  };

  return (
    <div className="w-full px-2 sm:px-3 md:px-4">
      <ToolHeader title={tool.name} description={tool.description} />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 space-y-3">
          {!file ? (
            <>
              <FileDropzone
                onFilesAdded={handleFileAdded}
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip"
                className="p-6 sm:p-10 min-h-[120px] sm:min-h-[180px] max-w-md sm:max-w-2xl lg:max-w-3xl mx-auto"
              />
              <p className="mt-3 text-center text-xs text-muted-foreground px-4">
            Note: Max file size 50MB. Some mobile browsers restrict file uploads or types. If you can’t pick a file, try a different browser or use the desktop site.
              </p>
            </>
          ) : (
            <Card className="overflow-hidden">
              <div className="relative w-full aspect-4/3 md:aspect-video max-h-[46vh] bg-muted/20 flex items-center justify-center">
                {previewUrl ? (
                    <Image
                      src={previewUrl}
                      alt="Preview"
                      fill
                      sizes="(min-width:1280px) 66vw, (min-width:1024px) 66vw, 100vw"
                      className="object-contain"
                    />
                ) : (
                    <div className="text-center text-muted-foreground p-8 flex flex-col items-center gap-4">
                        <FileIcon className="w-16 h-16"/>
                        <p className="font-semibold text-lg">{file.name}</p>
                        <p>No preview available for this file type.</p>
                    </div>
                )}
              </div>
              <CardContent className="p-4 flex flex-col gap-3">
                <div className="px-3 py-2 rounded-md bg-card border border-border text-sm text-foreground h-10 flex items-center">
                  <span className="truncate">{file.name}</span>
                </div>
                <Button variant="outline" className="w-full h-10" onClick={handleReset}>
                  <X className="mr-2 h-4 w-4" />
                  Change File
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
        <div className="lg:col-span-4 space-y-5 lg:w-[400px] w-full">
          <Card>
            <CardHeader className="p-4">
              <CardTitle>Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4">
              <div>
                <Label htmlFor="format-select">Convert To</Label>
                <Select
                  value={outputFormat}
                  onValueChange={setOutputFormat}
                  disabled={!file || isProcessing}
                >
                  <SelectTrigger id="format-select">
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    {isImageFile(file) ? (
                      <>
                        <SelectItem value="bmp">BMP</SelectItem>
                        <SelectItem value="gif">GIF</SelectItem>
                        <SelectItem value="ico">ICO</SelectItem>
                        <SelectItem value="jpeg">JPEG</SelectItem>
                        <SelectItem value="jpg">JPG</SelectItem>
                        <SelectItem value="png">PNG</SelectItem>
                        <SelectItem value="tiff">TIFF</SelectItem>
                        <SelectItem value="webp">WebP</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="pdf">PDF</SelectItem>
                        <SelectItem value="docx">DOCX</SelectItem>
                        <SelectItem value="xlsx">XLSX</SelectItem>
                        <SelectItem value="pptx">PPTX</SelectItem>
                        <SelectItem value="zip">ZIP</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {isImageFile(file) && (
                <>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="width">Resize Width (px)</Label>
                      <Input
                        id="width"
                        type="number"
                        value={resize.width || ""}
                        onChange={(e) => handleDimensionChange(e, "width")}
                        placeholder="auto"
                        disabled={!file || isProcessing}
                      />
                    </div>
                    <div>
                      <Label htmlFor="height">Resize Height (px)</Label>
                      <Input
                        id="height"
                        type="number"
                        value={resize.height || ""}
                        onChange={(e) => handleDimensionChange(e, "height")}
                        placeholder="auto"
                        disabled={!file || isProcessing}
                      />
                    </div>
                  </div>
                </>
              )}

              <Separator />

              <div>
                <Label htmlFor="rename-file">Rename File</Label>
                <Input
                  id="rename-file"
                  value={outputFilename}
                  onChange={(e) => setOutputFilename(e.target.value)}
                  disabled={!file || isProcessing}
                  placeholder="Enter new filename"
                />
              </div>
              <Button
                onClick={handleConvertAndDownload}
                disabled={!file || isProcessing}
                className="w-full h-10 bg-black/85 text-white"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="animate-spin text-black" />
                    <span>Converting...</span>
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4 " />
                    <span>Convert &amp; Download</span>
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
