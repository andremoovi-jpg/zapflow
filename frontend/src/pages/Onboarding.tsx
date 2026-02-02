import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, Loader2, ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const orgSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  slug: z.string()
    .min(3, 'Slug deve ter pelo menos 3 caracteres')
    .max(50, 'Slug deve ter no máximo 50 caracteres')
    .regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens'),
});

type OrgFormData = z.infer<typeof orgSchema>;

export default function Onboarding() {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { createOrganization, organizations, loading: orgLoading } = useOrganization();
  const { toast } = useToast();

  // Redirect if not logged in or already has organizations
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    } else if (!orgLoading && organizations.length > 0) {
      navigate('/');
    }
  }, [authLoading, user, orgLoading, organizations, navigate]);

  // Show loading while checking auth/org state
  if (authLoading || orgLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const form = useForm<OrgFormData>({
    resolver: zodResolver(orgSchema),
    defaultValues: {
      name: '',
      slug: '',
    },
  });

  const handleSubmit = async (data: OrgFormData) => {
    setIsLoading(true);
    const { error } = await createOrganization(data.name, data.slug);
    setIsLoading(false);

    if (error) {
      toast({
        title: 'Erro ao criar organização',
        description: error.message.includes('duplicate')
          ? 'Este slug já está em uso. Escolha outro.'
          : error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Organização criada!',
        description: 'Bem-vindo ao ZapFlow!',
      });
      navigate('/');
    }
  };

  // Auto-generate slug from name
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    form.setValue('name', name);
    
    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 50);
    
    form.setValue('slug', slug);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-background via-background to-accent/20">
      <div className="w-full max-w-md animate-slide-up">
        {/* Progress indicator */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-medium">
            <Check className="w-4 h-4" />
          </div>
          <div className="flex-1 h-1 bg-border rounded-full">
            <div className="h-full w-1/2 bg-primary rounded-full" />
          </div>
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-medium">
            2
          </div>
        </div>

        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
          <Building2 className="w-8 h-8 text-primary" />
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold mb-2">Criar sua organização</h1>
        <p className="text-muted-foreground mb-8">
          Organizações permitem que você gerencie equipes, contas WhatsApp e configurações de forma isolada.
        </p>

        {/* Form */}
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da organização</Label>
            <Input
              id="name"
              placeholder="Minha Empresa"
              {...form.register('name')}
              onChange={handleNameChange}
              className="h-11"
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Slug (URL)</Label>
            <div className="flex items-center">
              <span className="px-3 h-11 flex items-center bg-muted border border-r-0 rounded-l-lg text-sm text-muted-foreground">
                zapflow.io/
              </span>
              <Input
                id="slug"
                placeholder="minha-empresa"
                {...form.register('slug')}
                className="h-11 rounded-l-none"
              />
            </div>
            {form.formState.errors.slug && (
              <p className="text-sm text-destructive">{form.formState.errors.slug.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full h-11 mt-2" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Continuar
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Você poderá convidar membros da equipe depois.
        </p>
      </div>
    </div>
  );
}
