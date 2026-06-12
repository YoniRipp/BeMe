import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { request } from '@/core/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ImagePlaceholder } from '@/components/shared/ImagePlaceholder';
import { Upload, Trash2, Image as ImageIcon, Video, Link as LinkIcon, Play } from 'lucide-react';
import { toast } from '@/components/shared/ToastProvider';
import { EXERCISE_CATALOG_LIMIT } from '@/lib/constants';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ExerciseRow {
  id: string;
  name: string;
  muscleGroup: string | null;
  category: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

interface FoodRow {
  id: string;
  name: string;
  imageUrl: string | null;
}

type Tab = 'exercises' | 'foods';

const MUSCLE_GROUPS = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'full_body'];
const CATEGORIES = ['barbell', 'dumbbell', 'machine', 'bodyweight', 'cable', 'cardio'];

async function uploadToS3(file: File, context: string): Promise<string> {
  const { uploadUrl, fileUrl } = await request<{ uploadUrl: string; fileUrl: string }>('/api/uploads/presigned-url', {
    method: 'POST',
    body: { mimeType: file.type, context },
  });
  await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  });
  return fileUrl;
}

function invalidateExercises(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['admin', 'exercises'] });
  void queryClient.invalidateQueries({ queryKey: ['exercises'] });
}

function ExerciseCatalogTab() {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState('');
  const [newMuscleGroup, setNewMuscleGroup] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const imageFileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [videoUrlInput, setVideoUrlInput] = useState<Record<string, string>>({});
  const [showVideoInput, setShowVideoInput] = useState<Record<string, boolean>>({});
  const [imageUrlInput, setImageUrlInput] = useState<Record<string, string>>({});
  const [showImageUrlInput, setShowImageUrlInput] = useState<Record<string, boolean>>({});

  const { data: exercises = [], isLoading } = useQuery({
    queryKey: ['admin', 'exercises'],
    queryFn: (): Promise<ExerciseRow[]> => request(`/api/admin/exercises?limit=${EXERCISE_CATALOG_LIMIT}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => request(`/api/admin/exercises/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidateExercises(queryClient);
      toast.success('Exercise removed');
    },
  });

  const handleAddExercise = async (file?: File) => {
    const name = newName.trim();
    if (!name) {
      toast.error('Enter an exercise name first');
      return;
    }
    setUploading('new');
    try {
      let imageUrl: string | undefined;
      if (file) {
        imageUrl = await uploadToS3(file, 'workout');
      }
      await request('/api/admin/exercises', {
        method: 'POST',
        body: {
          name,
          muscleGroup: newMuscleGroup || undefined,
          category: newCategory || undefined,
          imageUrl,
        },
      });
      invalidateExercises(queryClient);
      setNewName('');
      setNewMuscleGroup('');
      setNewCategory('');
      toast.success(`Exercise "${name}" added`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add exercise');
    } finally {
      setUploading(null);
    }
  };

  const handleReplaceImage = async (id: string, file: File) => {
    setUploading(`img-${id}`);
    try {
      const imageUrl = await uploadToS3(file, 'workout');
      await request(`/api/admin/exercises/${id}`, {
        method: 'PATCH',
        body: { imageUrl },
      });
      invalidateExercises(queryClient);
      toast.success('Image updated');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(null);
    }
  };

  const handleUploadVideo = async (id: string, file: File) => {
    setUploading(`vid-${id}`);
    try {
      const videoUrl = await uploadToS3(file, 'exercise-video');
      await request(`/api/admin/exercises/${id}`, {
        method: 'PATCH',
        body: { videoUrl },
      });
      invalidateExercises(queryClient);
      toast.success('Video uploaded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Video upload failed');
    } finally {
      setUploading(null);
    }
  };

  const handleSetVideoUrl = async (id: string) => {
    const url = videoUrlInput[id]?.trim();
    if (!url) return;
    try {
      await request(`/api/admin/exercises/${id}`, {
        method: 'PATCH',
        body: { videoUrl: url },
      });
      invalidateExercises(queryClient);
      setVideoUrlInput(prev => ({ ...prev, [id]: '' }));
      setShowVideoInput(prev => ({ ...prev, [id]: false }));
      toast.success('Video URL saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save video URL');
    }
  };

  const handleRemoveVideo = async (id: string) => {
    try {
      await request(`/api/admin/exercises/${id}`, {
        method: 'PATCH',
        body: { videoUrl: '' },
      });
      invalidateExercises(queryClient);
      toast.success('Video removed');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove video');
    }
  };

  const handleSetImageUrl = async (id: string) => {
    const url = imageUrlInput[id]?.trim();
    if (!url) return;
    try {
      await request(`/api/admin/exercises/${id}`, {
        method: 'PATCH',
        body: { imageUrl: url },
      });
      invalidateExercises(queryClient);
      setImageUrlInput(prev => ({ ...prev, [id]: '' }));
      setShowImageUrlInput(prev => ({ ...prev, [id]: false }));
      toast.success('Image URL saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save image URL');
    }
  };

  const handleRemoveImage = async (id: string) => {
    try {
      await request(`/api/admin/exercises/${id}`, {
        method: 'PATCH',
        body: { imageUrl: '' },
      });
      invalidateExercises(queryClient);
      toast.success('Image removed');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove image');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add New Exercise</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Input
                placeholder="Exercise name (e.g. Bench Press)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select value={newMuscleGroup} onValueChange={setNewMuscleGroup}>
              <SelectTrigger>
                <SelectValue placeholder="Muscle group" />
              </SelectTrigger>
              <SelectContent>
                {MUSCLE_GROUPS.map(mg => (
                  <SelectItem key={mg} value={mg}>
                    {mg.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={newCategory} onValueChange={setNewCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <input
              ref={imageFileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleAddExercise(file);
                e.target.value = '';
              }}
            />
            <Button
              onClick={() => {
                if (!newName.trim()) {
                  toast.error('Enter an exercise name first');
                  return;
                }
                imageFileRef.current?.click();
              }}
              disabled={!newName.trim() || uploading === 'new'}
              variant="outline"
            >
              <Upload className="w-4 h-4 mr-1" />
              {uploading === 'new' ? 'Adding...' : 'Add with Image'}
            </Button>
            <Button
              onClick={() => handleAddExercise()}
              disabled={!newName.trim() || uploading === 'new'}
            >
              {uploading === 'new' ? 'Adding...' : 'Add Exercise'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : exercises.length === 0 ? (
        <p className="text-sm text-muted-foreground">No exercises yet. Add one above.</p>
      ) : (
        <div className="space-y-2">
          {exercises.map((ex) => (
            <div key={ex.id} className="p-3 bg-muted rounded-lg space-y-2">
              <div className="flex items-center gap-3">
                <ImagePlaceholder type="exercise" size="md" imageUrl={ex.imageUrl ?? undefined} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{ex.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {[ex.muscleGroup, ex.category].filter(Boolean).join(' · ') || 'No category'}
                  </p>
                </div>

                {/* Image upload/replace */}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  id={`img-${ex.id}`}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleReplaceImage(ex.id, file);
                    e.target.value = '';
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById(`img-${ex.id}`)?.click()}
                  disabled={uploading === `img-${ex.id}`}
                >
                  <Upload className="w-3 h-3 mr-1" />
                  {uploading === `img-${ex.id}` ? '...' : ex.imageUrl ? 'Replace' : 'Image'}
                </Button>

                {/* Video actions */}
                <input
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm"
                  className="hidden"
                  id={`vid-${ex.id}`}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadVideo(ex.id, file);
                    e.target.value = '';
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById(`vid-${ex.id}`)?.click()}
                  disabled={uploading === `vid-${ex.id}`}
                >
                  <Video className="w-3 h-3 mr-1" />
                  {uploading === `vid-${ex.id}` ? '...' : 'Video'}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowVideoInput(prev => ({ ...prev, [ex.id]: !prev[ex.id] }))}
                >
                  <LinkIcon className="w-3 h-3 mr-1" />
                  URL
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowImageUrlInput(prev => ({ ...prev, [ex.id]: !prev[ex.id] }))}
                >
                  <LinkIcon className="w-3 h-3 mr-1" />
                  Img URL
                </Button>

                {ex.imageUrl && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-orange-500"
                    onClick={() => handleRemoveImage(ex.id)}
                    title="Remove image"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => deleteMutation.mutate(ex.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              {/* Video URL indicator */}
              {ex.videoUrl && (
                <div className="flex items-center gap-2 ml-14 text-xs">
                  <Play className="w-3 h-3 text-green-600" />
                  <span className="text-muted-foreground truncate flex-1">{ex.videoUrl}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-destructive"
                    onClick={() => handleRemoveVideo(ex.id)}
                  >
                    Remove video
                  </Button>
                </div>
              )}

              {/* Video URL input */}
              {showVideoInput[ex.id] && (
                <div className="flex gap-2 ml-14">
                  <Input
                    placeholder="Paste YouTube or video URL..."
                    value={videoUrlInput[ex.id] || ''}
                    onChange={(e) => setVideoUrlInput(prev => ({ ...prev, [ex.id]: e.target.value }))}
                    className="flex-1 h-8 text-sm"
                  />
                  <Button
                    size="sm"
                    className="h-8"
                    onClick={() => handleSetVideoUrl(ex.id)}
                    disabled={!videoUrlInput[ex.id]?.trim()}
                  >
                    Save
                  </Button>
                </div>
              )}

              {/* Image URL input */}
              {showImageUrlInput[ex.id] && (
                <div className="flex gap-2 ml-14">
                  <Input
                    placeholder="Paste image URL..."
                    value={imageUrlInput[ex.id] || ''}
                    onChange={(e) => setImageUrlInput(prev => ({ ...prev, [ex.id]: e.target.value }))}
                    className="flex-1 h-8 text-sm"
                  />
                  <Button
                    size="sm"
                    className="h-8"
                    onClick={() => handleSetImageUrl(ex.id)}
                    disabled={!imageUrlInput[ex.id]?.trim()}
                  >
                    Save
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FoodImagesTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState<string | null>(null);
  const [imageUrlInput, setImageUrlInput] = useState<Record<string, string>>({});
  const [showImageUrlInput, setShowImageUrlInput] = useState<Record<string, boolean>>({});

  const { data: foods = [], isLoading } = useQuery({
    queryKey: ['admin', 'foods-with-images', search],
    queryFn: (): Promise<FoodRow[]> =>
      request(`/api/admin/foods/search?q=${encodeURIComponent(search)}&limit=25`),
    enabled: search.length >= 2,
  });

  const handleUpload = async (foodId: string, file: File) => {
    setUploading(foodId);
    try {
      const fileUrl = await uploadToS3(file, 'food');
      await request(`/api/admin/foods/${foodId}/image`, {
        method: 'PATCH',
        body: { imageUrl: fileUrl },
      });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'foods-with-images'] });
      toast.success('Food image updated');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(null);
    }
  };

  const handleRemove = async (foodId: string) => {
    try {
      await request(`/api/admin/foods/${foodId}/image`, { method: 'DELETE' });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'foods-with-images'] });
      toast.success('Food image removed');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove image');
    }
  };

  const handleSetImageUrl = async (foodId: string) => {
    const url = imageUrlInput[foodId]?.trim();
    if (!url) return;
    try {
      await request(`/api/admin/foods/${foodId}/image`, {
        method: 'PATCH',
        body: { imageUrl: url },
      });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'foods-with-images'] });
      setImageUrlInput(prev => ({ ...prev, [foodId]: '' }));
      setShowImageUrlInput(prev => ({ ...prev, [foodId]: false }));
      toast.success('Food image URL saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save image URL');
    }
  };

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search foods by name (min 2 characters)..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Searching...</p>
      ) : search.length < 2 ? (
        <p className="text-sm text-muted-foreground">Type at least 2 characters to search foods.</p>
      ) : foods.length === 0 ? (
        <p className="text-sm text-muted-foreground">No foods found.</p>
      ) : (
        <div className="space-y-2">
          {foods.map((food) => (
            <div key={food.id} className="p-3 bg-muted rounded-lg space-y-2">
              <div className="flex items-center gap-3">
                <ImagePlaceholder type="food" size="md" imageUrl={food.imageUrl ?? undefined} />
                <span className="flex-1 font-medium truncate">{food.name}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  id={`food-upload-${food.id}`}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(food.id, file);
                    e.target.value = '';
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById(`food-upload-${food.id}`)?.click()}
                  disabled={uploading === food.id}
                >
                  <Upload className="w-3 h-3 mr-1" />
                  {uploading === food.id ? 'Uploading...' : food.imageUrl ? 'Replace' : 'Upload'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowImageUrlInput(prev => ({ ...prev, [food.id]: !prev[food.id] }))}
                >
                  <LinkIcon className="w-3 h-3 mr-1" />
                  URL
                </Button>
                {food.imageUrl && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleRemove(food.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>

              {/* Image URL input */}
              {showImageUrlInput[food.id] && (
                <div className="flex gap-2 ml-14">
                  <Input
                    placeholder="Paste food image URL..."
                    value={imageUrlInput[food.id] || ''}
                    onChange={(e) => setImageUrlInput(prev => ({ ...prev, [food.id]: e.target.value }))}
                    className="flex-1 h-8 text-sm"
                  />
                  <Button
                    size="sm"
                    className="h-8"
                    onClick={() => handleSetImageUrl(food.id)}
                    disabled={!imageUrlInput[food.id]?.trim()}
                  >
                    Save
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminImagesPage() {
  const [tab, setTab] = useState<Tab>('exercises');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ImageIcon className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">Exercise Catalog & Images</h2>
      </div>

      <div className="flex gap-1 border-b border-border">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'exercises'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setTab('exercises')}
        >
          Exercise Catalog
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'foods'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setTab('foods')}
        >
          Food Images
        </button>
      </div>

      {tab === 'exercises' ? <ExerciseCatalogTab /> : <FoodImagesTab />}
    </div>
  );
}
