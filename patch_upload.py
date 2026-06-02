import re

path = '/data/data/com.termux/files/home/vibeschool/components/global/create/StoryPageBlock.tsx'

with open(path, 'r') as f:
    content = f.read()

# --- Patch 1: Add uploadError and uploadProgress state after uploading state ---
old_state = '  const [uploading,  setUploading]  = useState(false)'
new_state = '''  const [uploading,      setUploading]      = useState(false)
  const [uploadError,    setUploadError]    = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number>(0)'''

if old_state not in content:
    print('FAIL: uploading state line not found')
    exit(1)
content = content.replace(old_state, new_state)
print('OK: state declarations patched')

# --- Patch 2: Replace handleImageUpload ---
old_fn = '''  const handleImageUpload = async (file: File) => {
    setUploading(true)
    try {
      const ext       = file.name.split('.').pop() || 'jpg'
      const path      = `stories/${page.storyId}/page-${page.pageNumber}-${Date.now()}.${ext}`
      const { error } = await supabase.storage
        .from('vibelearn-content')
        .upload(path, file, { cacheControl: '3600', upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from('vibelearn-content').getPublicUrl(path)
      if (!data?.publicUrl) throw new Error('No public URL returned')
      onPageUpdate({ illustrationUrl: data.publicUrl })
    } catch (err: unknown) {
      console.error('Image upload failed:', err)
    } finally {
      setUploading(false)
    }
  }'''

new_fn = '''  const handleImageUpload = async (file: File) => {
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
    const MAX_BYTES = 5 * 1024 * 1024

    if (!ALLOWED_TYPES.includes(file.type)) {
      setUploadError('Only JPEG, PNG, and WebP images are allowed.')
      return
    }
    if (file.size > MAX_BYTES) {
      setUploadError(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max is 5MB.`)
      return
    }
    if (!page.storyId || page.pageNumber === undefined || page.pageNumber === null) {
      setUploadError('Cannot upload: story or page reference is missing.')
      return
    }

    let cancelled = false
    setUploading(true)
    setUploadError(null)
    setUploadProgress(0)

    try {
      const isPng       = file.type === 'image/png'
      const outputMime  = isPng ? 'image/png' : 'image/jpeg'
      const outputExt   = isPng ? 'png' : 'jpg'
      const quality     = isPng ? 1 : 0.85

      const compressed = await new Promise<Blob>((resolve, reject) => {
        const img = new Image()
        const url = URL.createObjectURL(file)
        img.onload = () => {
          URL.revokeObjectURL(url)
          const MAX_WIDTH = 800
          const scale = img.width > MAX_WIDTH ? MAX_WIDTH / img.width : 1
          const w = Math.round(img.width * scale)
          const h = Math.round(img.height * scale)
          const canvas = document.createElement('canvas')
          canvas.width  = w
          canvas.height = h
          const ctx = canvas.getContext('2d')!
          ctx.drawImage(img, 0, 0, w, h)
          canvas.toBlob(
            blob => {
              if (blob) resolve(blob)
              else reject(new Error('Canvas compression failed.'))
            },
            outputMime,
            quality
          )
        }
        img.onerror = () => {
          URL.revokeObjectURL(url)
          reject(new Error('Could not load image. File may be corrupted.'))
        }
        img.src = url
      })

      if (cancelled) return
      setUploadProgress(50)

      const filePath = `stories/${page.storyId}/page-${page.pageNumber}-${Date.now()}.${outputExt}`

      const ticker = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) { clearInterval(ticker); return 90 }
          return prev + 4
        })
      }, 120)

      const { error } = await supabase.storage
        .from('vibelearn-content')
        .upload(filePath, compressed, {
          contentType: outputMime,
          cacheControl: '3600',
          upsert: true,
        })

      clearInterval(ticker)
      if (error) throw error
      if (cancelled) return

      setUploadProgress(95)

      const { data } = supabase.storage.from('vibelearn-content').getPublicUrl(filePath)
      if (!data?.publicUrl) throw new Error('Storage did not return a public URL.')

      setUploadProgress(100)
      onPageUpdate({ illustrationUrl: data.publicUrl })

    } catch (err: unknown) {
      if (cancelled) return
      const message = err instanceof Error ? err.message : 'Upload failed. Please try again.'
      setUploadError(message)
      console.error('Image upload failed:', err)
      setUploadProgress(0)
    } finally {
      if (!cancelled) setUploading(false)
    }
  }'''

if old_fn not in content:
    print('FAIL: handleImageUpload function not found')
    exit(1)
content = content.replace(old_fn, new_fn)
print('OK: handleImageUpload patched')

# --- Patch 3: Add error/progress UI after StoryIllustrationSlot closing tag ---
old_slot = '''        <StoryIllustrationSlot
            illustrationUrl={page.illustrationUrl}
            illustrationPrompt={page.illustrationPrompt}
            backgroundColor={page.backgroundColor}
            onImageUpload={handleImageUpload}
            onPromptChange={prompt => onPageUpdate({ illustrationPrompt: prompt })}
            uploading={uploading}
          />'''

new_slot = '''        <StoryIllustrationSlot
            illustrationUrl={page.illustrationUrl}
            illustrationPrompt={page.illustrationPrompt}
            backgroundColor={page.backgroundColor}
            onImageUpload={handleImageUpload}
            onPromptChange={prompt => onPageUpdate({ illustrationPrompt: prompt })}
            uploading={uploading}
          />
          {uploading && (
            <div style={{ marginTop: 8, width: '100%' }}>
              <div style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4, height: 4 }}>
                <div style={{ width: `${uploadProgress}%`, backgroundColor: '#CCFF00', height: 4, borderRadius: 4, transition: 'width 0.15s ease' }} />
              </div>
              <div style={{ marginTop: 4, fontSize: 10, color: '#CCFF00', fontWeight: 600, letterSpacing: '0.04em' }}>
                {uploadProgress < 50 ? 'Compressing…' : uploadProgress < 100 ? `Uploading ${uploadProgress}%` : 'Done'}
              </div>
            </div>
          )}
          {uploadError && (
            <div style={{ marginTop: 8, fontSize: 11, color: '#FF4D4D', fontWeight: 600 }}>
              ⚠ {uploadError}
            </div>
          )}'''

if old_slot not in content:
    print('FAIL: StoryIllustrationSlot JSX not found')
    exit(1)
content = content.replace(old_slot, new_slot)
print('OK: UI feedback patched')

with open(path, 'w') as f:
    f.write(content)

print('DONE: StoryPageBlock.tsx patched successfully')
