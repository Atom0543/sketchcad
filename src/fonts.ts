// Fonts bundled for outline text (all SIL Open Font License; files are the Google Fonts releases).
import caveat from './fonts/Caveat_400Regular.ttf?url'
import caveatB from './fonts/Caveat_700Bold.ttf?url'
import sarabun from './fonts/Sarabun_400Regular.ttf?url'
import sarabunB from './fonts/Sarabun_700Bold.ttf?url'
import prompt from './fonts/Prompt_400Regular.ttf?url'
import promptB from './fonts/Prompt_700Bold.ttf?url'
import noto from './fonts/NotoSansThai_400Regular.ttf?url'
import notoB from './fonts/NotoSansThai_700Bold.ttf?url'
import kanit from './fonts/Kanit_400Regular.ttf?url'
import kanitB from './fonts/Kanit_700Bold.ttf?url'

export const FONTS = [
  { id: 'caveat', name: 'Caveat · ลายมือ (EN)', regular: caveat, bold: caveatB },
  { id: 'sarabun', name: 'Sarabun · มินิมอล (TH/EN)', regular: sarabun, bold: sarabunB },
  { id: 'prompt', name: 'Prompt · เรขาคณิต (TH/EN)', regular: prompt, bold: promptB },
  { id: 'noto', name: 'Noto Sans Thai · เรียบ (TH/EN)', regular: noto, bold: notoB },
  { id: 'kanit', name: 'Kanit · หนา เหลี่ยมมน (TH/EN)', regular: kanit, bold: kanitB },
]
