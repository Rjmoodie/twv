import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, X, FileText, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface BookOfRecordUploadProps {
  onDocumentsChange: (documents: string[], visibility: 'public' | 'premium' | 'on_request') => void;
  initialDocuments?: string[];
  initialVisibility?: 'public' | 'premium' | 'on_request';
}

const BookOfRecordUpload = ({ 
  onDocumentsChange, 
  initialDocuments = [], 
  initialVisibility = 'public' 
}: BookOfRecordUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [documents, setDocuments] = useState<string[]>(initialDocuments);
  const [visibility, setVisibility] = useState<'public' | 'premium' | 'on_request'>(initialVisibility);
  const { toast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Validate file count
    if (documents.length + files.length > 3) {
      toast({
        title: "Too many files",
        description: "Maximum 3 files allowed per listing",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const uploadPromises = Array.from(files).map(async (file) => {
        // Validate file
        const maxSize = 20 * 1024 * 1024; // 20MB
        if (file.size > maxSize) {
          throw new Error(`File ${file.name} is too large. Maximum size is 20MB.`);
        }

        const allowedTypes = ['application/pdf', 'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
        if (!allowedTypes.includes(file.type)) {
          throw new Error(`File ${file.name} is not supported. Please upload PDF, CSV, or XLSX files.`);
        }

        // Upload to Supabase Storage
        const fileName = `${user.id}/${Date.now()}-${file.name}`;
        const { data, error } = await supabase.storage
          .from('bor_uploads')
          .upload(fileName, file);

        if (error) throw error;

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('bor_uploads')
          .getPublicUrl(fileName);

        return urlData.publicUrl;
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      const newDocuments = [...documents, ...uploadedUrls];
      
      setDocuments(newDocuments);
      onDocumentsChange(newDocuments, visibility);

      toast({
        title: "Files uploaded successfully",
        description: `${uploadedUrls.length} file(s) uploaded to your Book of Record`
      });

    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload files. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveDocument = async (documentUrl: string) => {
    try {
      // Extract file path from URL
      const urlParts = documentUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const filePath = `${user.id}/${fileName}`;

      // Delete from storage
      await supabase.storage
        .from('bor_uploads')
        .remove([filePath]);

      const newDocuments = documents.filter(doc => doc !== documentUrl);
      setDocuments(newDocuments);
      onDocumentsChange(newDocuments, visibility);

      toast({
        title: "File removed",
        description: "Document removed from your Book of Record"
      });

    } catch (error) {
      console.error('Error removing document:', error);
      toast({
        title: "Error",
        description: "Failed to remove document",
        variant: "destructive"
      });
    }
  };

  const handleVisibilityChange = (newVisibility: 'public' | 'premium' | 'on_request') => {
    setVisibility(newVisibility);
    onDocumentsChange(documents, newVisibility);
  };

  const getFileName = (url: string) => {
    const parts = url.split('/');
    const fileName = parts[parts.length - 1];
    // Remove timestamp prefix
    return fileName.substring(fileName.indexOf('-') + 1);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          📁 Upload Financials
          <span className="text-sm font-normal text-muted-foreground">(Optional but Recommended)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Upload your Book of Record to build buyer confidence and increase inquiries. 
            Accepted formats: PDF, CSV, XLSX. Maximum 3 files, 20MB each.
          </AlertDescription>
        </Alert>

        {/* File Upload */}
        <div className="space-y-4">
          <div className="flex items-center justify-center w-full">
            <label htmlFor="bor-upload" className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
              uploading ? 'border-muted bg-muted/20' : 'border-muted-foreground/25 hover:border-primary hover:bg-primary/5'
            }`}>
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className={`w-8 h-8 mb-4 ${uploading ? 'text-muted-foreground' : 'text-muted-foreground'}`} />
                <p className="mb-2 text-sm text-muted-foreground">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-muted-foreground">PDF, CSV, XLSX (MAX. 20MB each)</p>
              </div>
              <input
                id="bor-upload"
                type="file"
                multiple
                accept=".pdf,.csv,.xlsx"
                onChange={handleFileUpload}
                disabled={uploading || documents.length >= 3}
                className="hidden"
              />
            </label>
          </div>

          {uploading && (
            <p className="text-sm text-muted-foreground text-center">Uploading files...</p>
          )}

          {/* Uploaded Documents */}
          {documents.length > 0 && (
            <div className="space-y-2">
              <Label>Uploaded Documents ({documents.length}/3)</Label>
              {documents.map((doc, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{getFileName(doc)}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveDocument(doc)}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Visibility Settings */}
        <div className="space-y-3">
          <Label htmlFor="bor-visibility">Document Visibility</Label>
          <Select value={visibility} onValueChange={handleVisibilityChange}>
            <SelectTrigger>
              <SelectValue placeholder="Choose visibility level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">
                <div className="flex flex-col items-start">
                  <span>Public</span>
                  <span className="text-xs text-muted-foreground">Any user can view and download</span>
                </div>
              </SelectItem>
              <SelectItem value="premium">
                <div className="flex flex-col items-start">
                  <span>Premium Only</span>
                  <span className="text-xs text-muted-foreground">Only premium buyers can access</span>
                </div>
              </SelectItem>
              <SelectItem value="on_request">
                <div className="flex flex-col items-start">
                  <span>Request Access</span>
                  <span className="text-xs text-muted-foreground">Buyers must message to request access</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
};

export default BookOfRecordUpload;