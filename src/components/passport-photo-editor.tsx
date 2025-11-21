"use client";

import { useState, useCallback, useEffect } from "react";
import Cropper, { type Point, type Area } from "react-easy-crop";
import { FileDropzone } from "@/components/file-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Loader2, Download, Wand2, ZoomIn, ZoomOut, Palette, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import NextImage from "next/image";
import { removeBackground, Config } from "@imgly/background-removal";

const PASSPORT_SIZES = [
  { name: "US Passport (2x2 inch)", width: 600, height: 600, mm: "51x51" },
  { name: "Schengen Visa (35x45 mm)", width: 413, height: 531, mm: "35x45" },
  { name: "Canada Passport (50x70 mm)", width: 591, height: 827, mm: "50x70" },
  { name: "India Passport (2x2 inch)", width: 600, height: 600, mm: "51x51" },
  { name: "Australia Passport (35x45 mm)", width: 413, height: 531, mm: "35x45" },
  { name: "UK Passport (35x45 mm)", width: 413, height: 531, mm: "35x45" },
  { name: "Pakistan Passport (35x45 mm)", width: 413, height: 531, mm: "35x45" },
  { name: "Philippines Passport (35x45 mm)", width: 413, height: 531, mm: "35x45" },
  { name: "Europe (35x45 mm)", width: 413, height: 531, mm: "35x45" },
  { name: "Custom", width: 500, height: 500, mm: "Custom" },
];

type Dimension = { name: string; width: number; height: number; mm: string };

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new window.Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });

async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
  outputWidth: number,
  outputHeight: number
): Promise<string> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Could not get canvas context");
  }

  canvas.width = outputWidth;
  canvas.height = outputHeight;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputWidth,
    outputHeight
  );

  return canvas.toDataURL("image/jpeg");
}

export function PassportPhotoEditor() {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  
  const [selectedSize, setSelectedSize] = useState<Dimension>(PASSPORT_SIZES[0]);
  const [customDimensions, setCustomDimensions] = useState({ width: 500, height: 500 });
  
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const [adjustments, setAdjustments] = useState({
    brightness: 100,
    contrast: 100,
    saturation: 100,
  });
  
  const [outputFilename, setOutputFilename] = useState("passport-photo");
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");

  const { toast } = useToast();

  const activeImage = processedImage || originalImage;
  const dimensions = selectedSize.name === "Custom" ? { ...selectedSize, ...customDimensions } : selectedSize;
  const aspectRatio = dimensions.width / dimensions.height;

  const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleFileAdded = (files: File[]) => {
    if (files[0]) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setOriginalImage(result);
        setProcessedImage(null);
        setZoom(1);
        setCrop({ x: 0, y: 0 });
        const nameWithoutExtension = files[0].name.split('.').slice(0, -1).join('.');
        setOutputFilename(nameWithoutExtension || 'passport-photo');
      };
      reader.readAsDataURL(files[0]);
    }
  };

  const handleReset = () => {
    setOriginalImage(null);
    setProcessedImage(null);
  };

  const handleRemoveBackground = async () => {
    if (!originalImage) return;

    setIsLoading(true);
    setLoadingMessage("Loading AI model (this may take a moment)...");
    toast({ title: 'AI Magic in Progress...', description: 'Initializing background removal...' });
    
    try {
      // Convert data URI to Blob for the library
      const response = await fetch(originalImage);
      const blob = await response.blob();

      const config: Config = {
        progress: (key: string, current: number, total: number) => {
           const percent = Math.round((current / total) * 100);
           setLoadingMessage(`Processing: ${percent}%`);
        },
        output: {
            format: 'image/png',
            quality: 0.8
        }
      };

      const imageBlob = await removeBackground(blob, config);

      const url = URL.createObjectURL(imageBlob);
      
      // We need to composite the background color manually since the lib returns transparent
      const img = await createImage(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
          ctx.fillStyle = backgroundColor;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          setProcessedImage(canvas.toDataURL('image/png'));
          toast({ title: 'Background Removed!', description: 'The background has been updated.' });
      } else {
           // Fallback to just the transparent image if canvas fails
           setProcessedImage(url);
      }

    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Background Removal Failed",
        description: "Could not process the image. Please try again.",
      });
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

  // Re-apply background color if it changes after processing
  useEffect(() => {
      if (processedImage && backgroundColor) {
          // Logic to re-apply background would go here
      }
  }, [backgroundColor, processedImage]);


  const handleDownload = async () => {
    if (!activeImage || !croppedAreaPixels) return;
    
    setIsDownloading(true);
    try {
        const croppedImage = await getCroppedImg(
            activeImage,
            croppedAreaPixels,
            dimensions.width,
            dimensions.height
        );
        
        const finalCanvas = document.createElement("canvas");
        const finalCtx = finalCanvas.getContext('2d');
        if (!finalCtx) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not process image for download.'});
            return;
        }

        const img = await createImage(croppedImage);
        finalCanvas.width = dimensions.width;
        finalCanvas.height = dimensions.height;
        
        // Apply filters
        finalCtx.filter = `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%) saturate(${adjustments.saturation}%)`;
        
        // Draw image
        finalCtx.drawImage(img, 0, 0);

        const link = document.createElement("a");
        link.href = finalCanvas.toDataURL('image/png');
        link.download = `${outputFilename}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to crop the image.'});
    } finally {
        setIsDownloading(false);
    }
  };
  
  if (!activeImage) {
    return (
      <div className="w-full px-2 sm:px-3 md:px-4">
        <FileDropzone
          onFilesAdded={handleFileAdded}
          accept="image/*"
          className="p-6 sm:p-10 min-h-[120px] sm:min-h-[180px] max-w-md sm:max-w-2xl lg:max-w-3xl mx-auto"
        />
        <p className="mt-3 text-center text-xs text-muted-foreground px-4">
          Tip: Max file size 10MB. On some mobile browsers, image picking can be limited. If you can’t select a photo, try a different browser or use the desktop site.
        </p>
        <div className="mt-3 flex justify-center">
          <label className="inline-flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Or use system picker:</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileAdded([f]);
              }}
              className="block text-xs bg-blue-500 border-2 p-2 cursor-pointer w-[170px]"
            />
          </label>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <div className="lg:col-span-8 order-2 lg:order-1">
        <Card className="overflow-hidden sticky top-24">
            <div className="relative w-full bg-muted/20 h-72 sm:h-96 md:h-[480px] lg:h-[520px]">
                <Cropper
                  image={activeImage}
                  crop={crop}
                  zoom={zoom}
                  aspect={aspectRatio}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
            </div>
            <CardContent className="p-4 bg-card/60 flex items-center justify-between">
                <Button variant="outline" onClick={handleReset}><X className="mr-2"/>Change Photo</Button>
                <div className="flex items-center gap-2 max-w-xs">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setZoom(z => Math.max(1, z - 0.1))}><ZoomOut className="w-4 h-4"/></Button>
                    <Slider id="zoom-slider" min={1} max={3} step={0.01} value={[zoom]} onValueChange={([val]) => setZoom(val)} />
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setZoom(z => Math.min(3, z + 0.1))}><ZoomIn className="w-4 h-4"/></Button>
                </div>
            </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-4 order-1 lg:order-2 w-full lg:w-[400px]">
        <Card>
          <CardHeader>
            <CardTitle>Settings & Download</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" defaultValue={["item-1", "item-2", "item-3"]} className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger>Dimensions</AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div>
                    <Label htmlFor="passport-size">Standard Size</Label>
                    <Select
                      value={selectedSize.name}
                      onValueChange={(value) => {
                        const newSize = PASSPORT_SIZES.find((s) => s.name === value)!;
                        setSelectedSize(newSize);
                      }}
                    >
                      <SelectTrigger id="passport-size"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PASSPORT_SIZES.map((size) => (
                          <SelectItem key={size.name} value={size.name}>{size.name} ({size.mm})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedSize.name === "Custom" && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="custom-width">Width (px)</Label>
                        <Input id="custom-width" type="number" value={customDimensions.width} onChange={(e) => setCustomDimensions(prev => ({...prev, width: parseInt(e.target.value) || 0}))} />
                      </div>
                      <div>
                        <Label htmlFor="custom-height">Height (px)</Label>
                        <Input id="custom-height" type="number" value={customDimensions.height} onChange={(e) => setCustomDimensions(prev => ({...prev, height: parseInt(e.target.value) || 0}))} />
                      </div>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2">
                <AccordionTrigger>Adjustments</AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div>
                    <Label>Brightness: {adjustments.brightness - 100}</Label>
                    <Slider min={0} max={200} step={1} value={[adjustments.brightness]} onValueChange={([val]) => setAdjustments(prev => ({...prev, brightness: val}))} />
                  </div>
                  <div>
                    <Label>Contrast: {adjustments.contrast - 100}</Label>
                    <Slider min={0} max={200} step={1} value={[adjustments.contrast]} onValueChange={([val]) => setAdjustments(prev => ({...prev, contrast: val}))} />
                  </div>
                  <div>
                    <Label>Saturation: {adjustments.saturation - 100}</Label>
                    <Slider min={0} max={200} step={1} value={[adjustments.saturation]} onValueChange={([val]) => setAdjustments(prev => ({...prev, saturation: val}))} />
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3">
                <AccordionTrigger>Background</AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="bg-color" className="flex items-center gap-2"><Palette/>Background Color</Label>
                    <Input id="bg-color" type="color" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} className="w-12 h-8 p-1"/>
                  </div>
                  <Button onClick={handleRemoveBackground} disabled={!originalImage || isLoading} className="w-full">
                    {isLoading ? <Loader2 className="animate-spin" /> : <Wand2 />}
                    {isLoading ? (loadingMessage || 'Processing...') : 'Remove Background'}
                  </Button>
                  {processedImage && (
                    <div className="relative border rounded-lg p-2">
                      <p className="text-xs font-semibold mb-2">Active Image:</p>
                      <div className="relative aspect-square w-full rounded-md overflow-hidden">
                        <NextImage src={processedImage} alt="Processed with new background" fill className="object-cover" />
                      </div>
                      <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => setProcessedImage(null)}><X className="w-4 h-4"/></Button>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="mt-6 space-y-4">
              <div>
                <Label htmlFor="rename-file">Rename File</Label>
                <Input
                  id="rename-file"
                  value={outputFilename}
                  onChange={(e) => setOutputFilename(e.target.value)}
                  placeholder="Enter filename"
                />
              </div>
              <Button onClick={handleDownload} className="w-full bg-black/85 text-white" disabled={isDownloading}>
                {isDownloading ? <Loader2 className="animate-spin" /> : <Download />}
                Crop & Download Photo
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}