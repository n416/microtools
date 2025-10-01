import React, { useState, useEffect } from 'react';
import { Box, Grid, Paper, Typography, Button, TextField } from '@mui/material';
import Header from '../components/Header';
import { GeminiApiClient } from '../api/geminiApiClient.js';
// ▼▼▼ ReduxのフックとActionをインポート ▼▼▼
import { useDispatch } from 'react-redux';
import { addWorkflow } from '../store/workflowSlice';

const initialKnowledgeBase = [
  { id: 'K001', text: '新車販売の契約には「注文書」と「売買契約書」が必要。' },
  { id: 'K002', text: '中古車買取の契約には「車両譲渡契約書」が必要。' },
  { id: 'K003', text: '車両登録には顧客の「印鑑証明書」と「委任状」が必須。' },
  { id: 'K004', text: '普通自動車（8ナンバー）の登録には「車庫証明書」が必要。' },
  { id: 'K005', text: '軽自動車（4ナンバー・8ナンバー）の登録では、地域により「車庫証明書」が不要な場合がある。' },
  { id: 'K006', text: 'オートローンを利用する顧客には、信販会社への「ローン申込書」の記入を案内する。' },
  { id: 'K007', text: '買取車両の査定時には「自動車検査証（車検証）」と「自賠責保険証明書」の原本を確認する。' },
  { id: 'K008', text: '下取り車両がある場合、自動車税の「納税証明書」も必要となる。' },
  { id: 'K101', text: 'キャブコンはトラックベースで居住空間が広いが、車高が高く運転に注意が必要。ファミリー層に人気。' },
  { id: 'K102', text: 'バンコンはハイエースなどがベースで普段使いしやすいが、室内高が低いモデルが多い。二人旅や夫婦向け。' },
  { id: 'K103', text: 'バスコンはマイクロバスがベースで最も広く豪華だが、価格と維持費が高い。' },
  { id: 'K104', text: '軽キャンパーは軽自動車ベースで維持費が安いが、就寝定員は1〜2名が限界。' },
  { id: 'K105', text: 'ベース車両にはトヨタ、日産、マツダ、いすゞなどがあり、駆動方式（2WD/4WD）やエンジン（ガソリン/ディーゼル）も選択肢となる。' },
  { id: 'K201', text: 'サブバッテリーはエンジン停止中に電装品を使うための必須装備。容量（Ah）が大きいほど長時間使える。' },
  { id: 'K202', text: 'ソーラーパネルはサブバッテリーを補助充電するための人気オプション。長期旅行や災害時に有効。' },
  { id: 'K203', text: 'FFヒーターはエンジン停止中に車内を暖めるための装備。特に寒冷地での利用や冬場の車中泊には必須。' },
  { id: 'K204', text: '家庭用エアコンは快適性が非常に高いが、大容量のサブバッテリーや外部電源接続がほぼ必須となる。' },
  { id: 'K205', text: 'トイレには、本格的な「カセットトイレ」と簡易的な「ポータブルトイレ」の2種類がある。' },
  { id: 'K206', text: '冷蔵庫は、省電力なDC12V専用モデルが主流。' },
  { id: 'K207', text: 'サイドオーニング（日除け）は、屋外での滞在を快適にするための定番オプション。' },
  { id: 'K301', text: '最初の接客では、まず顧客の利用目的（旅行、趣味、防災など）、利用人数、予算をヒアリングすることが最重要。' },
  { id: 'K302', text: '見積書には、車両本体価格の他に、法定費用（税金・自賠責）、登録諸費用、納車準備費用、希望オプション費用を明記する。' },
  { id: 'K303', text: '納期はベース車両の在庫や架装（カスタム製作）の状況により大きく変動するため、契約前に必ず目安を伝える。' },
  { id: 'K304', text: '納車時には、車両の運転操作だけでなく、給排水の方法、電装品の操作方法、ガスの取り扱いなどを1時間以上かけて丁寧に説明する。' },
  { id: 'K305', text: '重大なクレーム（雨漏り、電装系の不動など）には、最優先で対応し、迅速な車両引き取りと原因調査を行う。' },
  { id: 'K306', text: '中古車の査定では、内外装の傷や汚れ、装備品の動作確認、事故歴の有無をチェックシートに基づいて行う。' },
];

function FlowDesignerPage() {
  // ▼▼▼ dispatch関数を取得 ▼▼▼
  const dispatch = useDispatch();

  const [knowledgeBase, setKnowledgeBase] = useState([]);
  const [newKnowledgeText, setNewKnowledgeText] = useState('');
  const [instruction, setInstruction] = useState('');
  const [generatedTasks, setGeneratedTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newFlowName, setNewFlowName] = useState('');

  useEffect(() => {
    const savedKnowledge = JSON.parse(localStorage.getItem('knowledgeBase')) || initialKnowledgeBase;
    setKnowledgeBase(savedKnowledge);
  }, []);

  const handleAddKnowledge = () => {
    if (newKnowledgeText.trim()) {
        const newIdNumber = knowledgeBase.length > 0 ? Math.max(...knowledgeBase.map(item => parseInt(item.id.substring(1)))) + 1 : 1;
        const newKnowledge = { id: `K${String(newIdNumber).padStart(3, '0')}`, text: newKnowledgeText.trim() };
        const updatedKnowledgeBase = [...knowledgeBase, newKnowledge];
        setKnowledgeBase(updatedKnowledgeBase);
        localStorage.setItem('knowledgeBase', JSON.stringify(updatedKnowledgeBase));
        setNewKnowledgeText('');
    }
  };

  const handleGenerateFlow = async () => {
    if (!instruction.trim() || knowledgeBase.length === 0) {
        alert('「知識ベース」と「AIへの指示」の両方を入力してください。');
        return;
    }
    setIsLoading(true);
    setGeneratedTasks([]);

    try {
        const gemini = new GeminiApiClient();
        if (!gemini.isAvailable) {
            throw new Error('APIキーと使用モデルが未設定です。右上の設定アイコンから登録・選択してください。');
        }
        const knowledgeText = knowledgeBase.map(k => `${k.id}: ${k.text}`).join('\n');
        const prompt = `あなたは優秀な業務コンサルタントです。以下の【知識リスト】を制約条件として厳守し、ユーザーからの【指示】に合致する業務フローを、論理的に矛盾のないステップ・バイ・ステップのリスト形式で提案してください。各ステップがどの知識に基づいているか、IDを明記してください。\n\n【知識リスト】\n${knowledgeText}\n\n【指示】\n${instruction}\n\n【出力形式】\n- (タスク内容1) (根拠: KXXX)\n- (タスク内容2) (根拠: KXXX)\n- (AIが補完したタスク内容)`;
        
        const resultText = await gemini.generateContent(prompt);
        
        const tasks = resultText.split('\n').filter(line => line.trim().startsWith('-')).map((line, index) => {
            const match = line.match(/- (.+?) \(根拠: (K\d+)\)/);
            return {
                id: index + 1,
                text: match ? match[1].trim() : line.replace('-', '').trim(),
                refId: match ? match[2].trim() : 'AI',
                completed: false,
                details: '',
            };
        });
        setGeneratedTasks(tasks);
    } catch (error) {
        console.error('API呼び出し中にエラーが発生しました:', error);
        alert(`エラー: ${error.message}`);
    } finally {
        setIsLoading(false);
    }
  };

  // ▼▼▼ 修正: フローの保存処理をReduxのActionをdispatchするように変更 ▼▼▼
  const handleSaveFlow = () => {
    if (!newFlowName.trim()) {
        alert('フロー名を入力してください。');
        return;
    }
    if (generatedTasks.length === 0) {
        alert('保存するタスクがありません。');
        return;
    }
    
    const newFlow = {
        id: `wf${Date.now()}`,
        name: newFlowName.trim(),
        description: `AIによって「${instruction.substring(0, 20)}...」という指示を元に生成されました。`,
        tasks: generatedTasks
    };

    // dispatchを使って、Reduxストアに新しいフローを追加する
    dispatch(addWorkflow(newFlow));
    
    alert('新しいフローが保存されました！顧客管理画面で利用できます。');
    setNewFlowName('');
    setInstruction('');
    setGeneratedTasks([]);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default' }}>
      <Box sx={{ p: '0 24px' }}>
         <Header isLocked={false} /> 
      </Box>
      
      <Box sx={{ flexGrow: 1, p: '0 24px 24px 24px', display: 'flex', gap: 2, minHeight: 0 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={5}>
            <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" gutterBottom>① 知識ベース</Typography>
              <TextField
                label="新しい知識"
                multiline
                rows={4}
                variant="outlined"
                fullWidth
                value={newKnowledgeText}
                onChange={(e) => setNewKnowledgeText(e.target.value)}
                placeholder="例: 普通自動車の契約には印鑑証明書が必要"
                sx={{ mb: 1 }}
              />
              <Button variant="contained" onClick={handleAddKnowledge} sx={{ mb: 2 }}>知識を登録</Button>
              <Box sx={{ overflow: 'auto', flexGrow: 1 }}>
                {knowledgeBase.map(item => (
                    <Paper key={item.id} variant="outlined" sx={{ p: 1, mb: 1 }}>
                       <Typography variant="caption">{item.id}</Typography>
                       <Typography variant="body2">{item.text}</Typography>
                    </Paper>
                ))}
              </Box>
            </Paper>
          </Grid>
          <Grid item xs={12} md={7}>
             <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
               <Typography variant="h6" gutterBottom>② フロー生成</Typography>
               <TextField
                label="AIへの指示"
                multiline
                rows={4}
                variant="outlined"
                fullWidth
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="例: 軽自動車の新規契約で、値引き交渉があった場合のフロー"
                sx={{ mb: 1 }}
               />
               <Button variant="contained" color="primary" onClick={handleGenerateFlow} disabled={isLoading}>
                {isLoading ? '生成中...' : 'フローを生成'}
               </Button>
               <Box sx={{ overflow: 'auto', flexGrow: 1, my: 2, p:1, border: '1px solid #eee', borderRadius: 1 }}>
                {generatedTasks.map(task => (
                    <Paper key={task.id} variant="outlined" sx={{ p: 1, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="caption" sx={{bgcolor: 'grey.200', p: '2px 8px', borderRadius: '12px'}}>{task.refId}</Typography>
                        <Typography variant="body2">{task.text}</Typography>
                    </Paper>
                ))}
               </Box>
               <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField
                        label="新しいフロー名"
                        variant="outlined"
                        fullWidth
                        value={newFlowName}
                        onChange={(e) => setNewFlowName(e.target.value)}
                    />
                    <Button variant="contained" color="success" onClick={handleSaveFlow}>
                        このフローを保存
                    </Button>
               </Box>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}

export default FlowDesignerPage;