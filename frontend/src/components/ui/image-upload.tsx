import { useState, useRef } from 'react';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  placeholder?: string;
  bucket?: string;
  folder?: string;
  accept?: string;
  maxSizeMB?: number;
  className?: string;
}

export function ImageUpload({
  value,
  onChange,
  placeholder = "URL da imagem ou faça upload",
  bucket = "campaign-assets",
  folder = "images",
  accept = "image/png,image/jpeg,image/jpg",
  maxSizeMB = 5,
  className
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      toast.error('Formato inválido. Use PNG ou JPEG.');
      return;
    }

    // Validar tamanho
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > maxSizeMB) {
      toast.error(`Imagem muito grande. Máximo ${maxSizeMB}MB.`);
      return;
    }

    setIsUploading(true);
    try {
      // Gerar nome único
      const ext = file.name.split('.').pop();
      const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      // Upload para Supabase Storage
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Upload error:', error);
        toast.error('Erro ao fazer upload: ' + error.message);
        return;
      }

      // Obter URL pública
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      if (urlData?.publicUrl) {
        onChange(urlData.publicUrl);
        setPreviewError(false);
        toast.success('Imagem enviada!');
      }
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Erro ao fazer upload');
    } finally {
      setIsUploading(false);
      // Limpar input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClear = () => {
    onChange('');
    setPreviewError(false);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex gap-2">
        <Input
          placeholder={placeholder}
          value={value || ''}
          onChange={(e) => {
            onChange(e.target.value);
            setPreviewError(false);
          }}
          className="text-sm flex-1"
        />
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileSelect}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          title="Fazer upload"
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
        </Button>
        {value && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleClear}
            title="Remover"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Preview */}
      {value && (
        <div className="relative w-full h-32 bg-muted rounded-md overflow-hidden">
          {previewError ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <ImageIcon className="h-8 w-8 mr-2" />
              <span className="text-sm">Erro ao carregar preview</span>
            </div>
          ) : (
            <img
              src={value}
              alt="Preview"
              className="w-full h-full object-contain"
              onError={() => setPreviewError(true)}
            />
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Formatos aceitos: PNG, JPEG. Máximo {maxSizeMB}MB.
      </p>
    </div>
  );
}
