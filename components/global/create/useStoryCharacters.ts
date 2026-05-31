'use client'

import { useCallback } from 'react'
import {
  VibeStory,
  StoryCharacter,
  emptyCharacter,
} from '@/lib/storyTypes'

export function useStoryCharacters(
  characters: StoryCharacter[],
  updateStory: (patch: Partial<VibeStory>) => void
) {
  const addCharacter = useCallback(() => {
    updateStory({ characters: [...characters, emptyCharacter()] })
  }, [characters, updateStory])

  const updateCharacter = useCallback((id: string, patch: Partial<StoryCharacter>) => {
    updateStory({
      characters: characters.map(c => c.id === id ? { ...c, ...patch } : c)
    })
  }, [characters, updateStory])

  const removeCharacter = useCallback((id: string) => {
    if (characters.length === 0) return
    updateStory({ characters: characters.filter(c => c.id !== id) })
  }, [characters, updateStory])

  const getCharacter = useCallback((id: string): StoryCharacter | undefined => {
    return characters.find(c => c.id === id)
  }, [characters])

  return { characters, addCharacter, updateCharacter, removeCharacter, getCharacter }
}
