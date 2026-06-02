path = '/data/data/com.termux/files/home/vibeschool/components/global/create/StoryPageBlock.tsx'

with open(path, 'r') as f:
    content = f.read()

old_slot = '\t        <StoryIllustrationSlot\n\t          illustrationUrl={page.illustrationUrl}\n\t          illustrationPrompt={page.illustrationPrompt}\n\t          backgroundColor={page.backgroundColor}\n\t          onImageUpload={handleImageUpload}\n\t          onPromptChange={prompt => onPageUpdate({ illustrationPrompt: prompt })}\n\t          uploading={uploading}\n\t        />\n\t      </div>'

new_slot = '\t        <StoryIllustrationSlot\n\t          illustrationUrl={page.illustrationUrl}\n\t          illustrationPrompt={page.illustrationPrompt}\n\t          backgroundColor={page.backgroundColor}\n\t          onImageUpload={handleImageUpload}\n\t          onPromptChange={prompt => onPageUpdate({ illustrationPrompt: prompt })}\n\t          uploading={uploading}\n\t        />\n\t        {uploading && (\n\t          <div style={{ marginTop: 8, width: \'100%\' }}>\n\t            <div style={{ width: \'100%\', backgroundColor: \'rgba(255,255,255,0.08)\', borderRadius: 4, height: 4 }}>\n\t              <div style={{ width: `${uploadProgress}%`, backgroundColor: \'#CCFF00\', height: 4, borderRadius: 4, transition: \'width 0.15s ease\' }} />\n\t            </div>\n\t            <div style={{ marginTop: 4, fontSize: 10, color: \'#CCFF00\', fontWeight: 600, letterSpacing: \'0.04em\' }}>\n\t              {uploadProgress < 50 ? \'Compressing…\' : uploadProgress < 100 ? `Uploading ${uploadProgress}%` : \'Done\'}\n\t            </div>\n\t          </div>\n\t        )}\n\t        {uploadError && (\n\t          <div style={{ marginTop: 8, fontSize: 11, color: \'#FF4D4D\', fontWeight: 600 }}>\n\t            ⚠ {uploadError}\n\t          </div>\n\t        )}\n\t      </div>'

if old_slot not in content:
    print('FAIL: slot not found')
    exit(1)

content = content.replace(old_slot, new_slot)

with open(path, 'w') as f:
    f.write(content)

print('DONE: UI feedback patched')
