import { supabase } from '@/lib/supabaseClient';
import { toast } from '@/components/ui/use-toast';

export const fetchFavorites = async (userId) => {
  if (!userId) return [];
  
  try {
    const { data, error } = await supabase
      .from('favorites')
      .select('content_id, content_type')
      .eq('user_id', userId);

    if (error) {
      // If the table isn't deployed yet, don't break the app.
      const status = error?.status ?? error?.statusCode;
      if (status === 404) return [];
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error("Error fetching favorites:", error);
    return [];
  }
};

export const addFavoriteItem = async (userId, contentType, contentId) => {
  if (!userId || !contentType || !contentId) {
    const errorMsg = 'User, content type, and content ID are required to add a favorite.';
    toast({ title: 'Error', description: errorMsg, variant: 'destructive' });
    throw new Error(errorMsg);
  }

  try {
    const { error } = await supabase
      .from('favorites')
      .insert({ user_id: userId, content_type: contentType, content_id: contentId });
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error adding favorite:', error);
    toast({ title: 'Error adding favorite', description: error.message, variant: 'destructive' });
    throw error;
  }
};

export const removeFavoriteItem = async (userId, contentType, contentId) => {
  if (!userId || !contentType || !contentId) {
    const errorMsg = 'User, content type, and content ID are required to remove a favorite.';
    toast({ title: 'Error', description: errorMsg, variant: 'destructive' });
    throw new Error(errorMsg);
  }

  try {
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('content_type', contentType)
      .eq('content_id', contentId);
      
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error removing favorite:', error);
    toast({ title: 'Error removing favorite', description: error.message, variant: 'destructive' });
    throw error;
  }
};
