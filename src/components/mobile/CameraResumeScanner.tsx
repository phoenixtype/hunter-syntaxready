import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, Upload, FileText, X } from "lucide-react";
import { toast } from "sonner";
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from "@capacitor/camera";

interface CameraResumeScannerProps {
  onImageCaptured?: (imageData: string) => void;
  onFileSelected?: (file: File) => void;
  onClose?: () => void;
}

export const CameraResumeScanner = ({
  onImageCaptured,
  onFileSelected,
  onClose
}: CameraResumeScannerProps) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const takePhoto = async () => {
    try {
      setIsCapturing(true);

      const photo = await CapacitorCamera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        quality: 80,
        correctOrientation: true,
        width: 1200, // Optimize for OCR
        height: 1600
      });

      if (photo.dataUrl) {
        setPreviewImage(photo.dataUrl);
        onImageCaptured?.(photo.dataUrl);
        toast.success("Photo captured! Processing...");
      }
    } catch (error) {
      console.error('Camera error:', error);
      toast.error("Camera access denied or unavailable");
    } finally {
      setIsCapturing(false);
    }
  };

  const selectFromGallery = async () => {
    try {
      const photo = await CapacitorCamera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos,
        quality: 90,
        correctOrientation: true
      });

      if (photo.dataUrl) {
        setPreviewImage(photo.dataUrl);
        onImageCaptured?.(photo.dataUrl);
        toast.success("Image selected! Processing...");
      }
    } catch (error) {
      console.error('Gallery error:', error);
      toast.error("Gallery access denied or unavailable");
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB");
        return;
      }

      if (!file.type.includes('pdf') && !file.type.includes('image')) {
        toast.error("Please select a PDF or image file");
        return;
      }

      onFileSelected?.(file);
      toast.success("File selected! Processing...");
      onClose?.();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Scan Resume</h3>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Preview */}
          {previewImage && (
            <div className="mb-6">
              <img
                src={previewImage}
                alt="Resume preview"
                className="w-full h-48 object-cover rounded-lg border"
              />
              <p className="text-sm text-center text-gray-500 mt-2">
                Resume captured successfully!
              </p>
            </div>
          )}

          {/* Capture options */}
          <div className="space-y-3">
            <Button
              className="w-full h-12 text-base"
              onClick={takePhoto}
              disabled={isCapturing}
            >
              <Camera className="w-5 h-5 mr-2" />
              {isCapturing ? "Opening Camera..." : "Take Photo"}
            </Button>

            <Button
              variant="outline"
              className="w-full h-12 text-base"
              onClick={selectFromGallery}
            >
              <Upload className="w-5 h-5 mr-2" />
              Choose from Gallery
            </Button>

            <div className="relative">
              <Button
                variant="outline"
                className="w-full h-12 text-base"
                asChild
              >
                <label htmlFor="file-upload" className="cursor-pointer">
                  <FileText className="w-5 h-5 mr-2" />
                  Upload PDF/Document
                </label>
              </Button>
              <input
                id="file-upload"
                type="file"
                accept=".pdf,.doc,.docx,image/*"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </div>
          </div>

          {/* Tips */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-sm mb-2">📱 Tips for best results:</h4>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• Ensure good lighting</li>
              <li>• Keep the resume flat and straight</li>
              <li>• Include all pages if multi-page</li>
              <li>• Make sure text is clearly visible</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};