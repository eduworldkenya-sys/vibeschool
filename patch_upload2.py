path = '/data/data/com.termux/files/home/vibeschool/components/global/create/StoryPageBlock.tsx'

with open(path, 'r') as f:
    content = f.read()

old_slot = '''          <StoryIllustrationSlot
            illustrationUrl={page.illustrationUrl}
            illustrationPrompt={page.illustrationPrompt}
            backgroundColor={page.backgroundColor}
            onImageUpload={handleImageUpload}
            onPromptChange={prompt => onPageUpdate({ illustrationPrompt: prompt })}
            uploading={uploading}
          />
        </div>'''

new_slot = '''          <StoryIllustrationSlot
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
          )}
        </div>'''

if old_slot not in content:
    print('FAIL: slot not found')
    exit(1)

content = content.replace(old_slot, new_slot)

with open(path, 'w') as f:
    f.write(content)

print('DONE: UI feedback patched')
