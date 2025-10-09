import { useState } from 'react';
import {
    Modal, Box, Typography, TextField, Button, CircularProgress, Stepper, Step, StepLabel, Chip, Stack,
    Paper, List, ListItem, ListItemText, Divider, Alert, Accordion, AccordionSummary, AccordionDetails, ListItemIcon
} from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { GeminiApiClient } from '../api/geminiApiClient.js';
import { setKnowledgeLibrary } from '../store/knowledgeSlice';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditIcon from '@mui/icons-material/Edit';
import { nanoid } from '@reduxjs/toolkit';

const modalStyle = {
    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
    width: '90%', maxWidth: '900px', bgcolor: 'background.paper', border: '2px solid #000',
    boxShadow: 24, p: 4, display: 'flex', flexDirection: 'column', maxHeight: '90vh',
};

const steps = ['業界', '業務活動', '顧客体験', '補足', 'AIによる生成', '確認と反映'];

// AIの応答からJSON部分だけを安全に抽出する関数
const extractJson = (text) => {
    const match = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
        return JSON.parse(match[1]);
    }
    // バッククォートがない場合も想定
    const firstBracket = text.indexOf('[');
    const firstBrace = text.indexOf('{');
    let startIndex = -1;

    if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
        startIndex = firstBracket;
    } else if (firstBrace !== -1) {
        startIndex = firstBrace;
    }

    if (startIndex === -1) {
        throw new Error("AIの応答に有効なJSONが含まれていません。");
    }
    
    const lastBracket = text.lastIndexOf(']');
    const lastBrace = text.lastIndexOf('}');
    const endIndex = Math.max(lastBracket, lastBrace);

    if (endIndex === -1) {
         throw new Error("AIの応答に有効なJSONが含まれていません。");
    }

    const jsonString = text.substring(startIndex, endIndex + 1);
    return JSON.parse(jsonString);
};


function KnowledgeSetupAssistant({ open, onClose, isInitialSetup }) {
    const dispatch = useDispatch();
    const { library: existingLibrary } = useSelector(state => state.knowledge);
    const [activeStep, setActiveStep] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [formData, setFormData] = useState({ industry: '', activities: [], customerFlow: '', notes: '' });
    const [suggestedActivities, setSuggestedActivities] = useState([]);
    const [mergedKnowledge, setMergedKnowledge] = useState([]);
    const [diff, setDiff] = useState(null);
    const [activityInput, setActivityInput] = useState('');

    const handleNext = async () => {
        setIsLoading(true);
        try {
            if (activeStep === 0) {
                setLoadingMessage('AIが業務活動を提案中...');
                await handleGenerateActivities();
                setActiveStep(1);
            } else if (activeStep === 1) {
                setLoadingMessage('AIが顧客体験の流れを提案中...');
                await handleGenerateCustomerFlow();
                setActiveStep(2);
            } else if (activeStep === 3) {
                await handleFinalGenerateAndMerge();
            } else if (activeStep === 5) {
                handleApply();
            } else {
                setActiveStep((prev) => prev + 1);
            }
        } catch (error) {
            console.error('Step transition failed:', error);
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    };

    const handleBack = () => setActiveStep((prev) => prev - 1);

    const handleReset = () => {
        setActiveStep(0);
        setFormData({ industry: '', activities: [], customerFlow: '', notes: '' });
        setSuggestedActivities([]);
        setMergedKnowledge([]);
        setDiff(null);
        onClose();
    };

    const handleGenerateActivities = async () => {
        const gemini = new GeminiApiClient();
        if (!gemini.isAvailable) {
            alert('Gemini APIキーまたはモデルIDが設定されていません。');
            throw new Error('API not available');
        }
        const prompt = `「${formData.industry}」において、一般的に行われる主要な業務活動を、10個程度のキーワードとして、カンマ区切りでリストアップしてください。キーワードのみを出力し、余計な説明は含めないでください。`;
        const resultText = await gemini.generateContent(prompt);
        const activities = resultText.split(',').map(a => a.trim()).filter(Boolean);
        setSuggestedActivities(activities);
    };

    const handleGenerateCustomerFlow = async () => {
        if (formData.activities.length === 0) {
            setFormData(prev => ({ ...prev, customerFlow: '' }));
            return;
        };
        const gemini = new GeminiApiClient();
        if (!gemini.isAvailable) {
            alert('Gemini APIキーまたはモデルIDが設定されていません。');
            throw new Error('API not available');
        }
        const prompt = `「${formData.industry}」において、「${formData.activities.join('」と「')}」を行う会社の、一般的な顧客体験の流れを、箇条書きの形式で提案してください。箇条書きのみを出力し、余計な説明は含めないでください。`;
        const resultText = await gemini.generateContent(prompt);
        setFormData(prev => ({ ...prev, customerFlow: resultText }));
    };

    const handleActivityToggle = (activity) => {
        setFormData(prev => ({ ...prev, activities: prev.activities.includes(activity) ? prev.activities.filter(a => a !== activity) : [...prev.activities, activity] }));
    };

    const handleActivityAdd = (event) => {
        if (event.key === 'Enter' && activityInput.trim() !== '') {
            const newActivity = activityInput.trim();
            if (!formData.activities.includes(newActivity)) setFormData(prev => ({ ...prev, activities: [...prev.activities, newActivity] }));
            if (!suggestedActivities.includes(newActivity)) setSuggestedActivities(prev => [...prev, newActivity]);
            setActivityInput('');
            event.preventDefault();
        }
    };

    const handleFinalGenerateAndMerge = async () => {
        console.log("--- handleFinalGenerateAndMerge function CALLED ---");

        setActiveStep(4);
        const gemini = new GeminiApiClient();
        if (!gemini.isAvailable) {
            alert('Gemini APIキーまたはモデルIDが設定されていません。「ユーザー設定」ページをご確認ください。');
            setActiveStep(3);
            return;
        }

        try {
            // Step 1: Generate Phase List
            setLoadingMessage('ステップ1/3: AIが業務フェーズを抽出中...');
            const phasesPrompt = `あなたは優秀な業務コンサルタントです。以下の顧客体験の流れを分析し、業務の大きな区切りとなる「フェーズ」を抽出してください。
# 顧客体験の流れ
${formData.customerFlow}
# 指示
- 抽出したフェーズ名をJSONの配列形式で、["フェーズ1", "フェーズ2", ...] のように出力してください。
- 配列以外のテキストは含めないでください。`;
            const phasesText = await gemini.generateContent(phasesPrompt);
            const phaseNames = extractJson(phasesText);
            if (!Array.isArray(phaseNames)) throw new Error("フェーズの抽出に失敗しました。AIの応答が配列ではありません。");

            // Step 2: Generate Knowledge for each Phase
            let candidates = [];
            for (let i = 0; i < phaseNames.length; i++) {
                const phaseName = phaseNames[i];
                setLoadingMessage(`ステップ2/${phaseNames.length}: フェーズ「${phaseName}」の知識を生成中...`);

                const knowledgePrompt = `あなたは優秀な業務コンサルタントです。
# ユーザーの入力情報
- 業界: ${formData.industry}
- 顧客体験の主な流れ: ${formData.customerFlow}
# 指示
「${phaseName}」という業務フェーズにおいて、企業が実行すべき具体的なタスク（知識）を洗い出してください。
タスクが分岐する可能性がある場合は type を 'branch' に設定してください。
# 出力JSONの仕様
- 各タスクを「知識」オブジェクトとしてJSON配列で出力してください。
- 各知識には、 text(タスク名), details(詳細), type('task' or 'branch') を含めてください。
- **【重要】typeが 'branch' の場合、ユーザーが選択すべき具体的な選択肢を options 配列に { "id": "opt-...", "label": "選択肢名" } の形式で2〜3個生成してください。**
- サンプル: [{"id": "k-auto-001", "text": "...", "details": "...", "type": "task", "options": []}, {"id": "k-auto-002", "text": "プラン選択", "details": "...", "type": "branch", "options": [{"id": "opt-001", "label": "Aプラン"}, {"id": "opt-002", "label": "Bプラン"}] }]
- JSON配列以外のテキストは含めないでください。`;

                const knowledgeText = await gemini.generateContent(knowledgePrompt);
                const knowledges = extractJson(knowledgeText);
                if (!Array.isArray(knowledges)) continue;

                candidates.push({
                    id: `phase-auto-${nanoid()}`,
                    name: phaseName,
                    knowledges: knowledges.map(k => ({ ...k, id: `k-auto-${nanoid()}`, options: k.options || [] })), // optionsがない場合に備える
                    subPhases: [],
                });
            }

            if (isInitialSetup) {
                const finalResult = candidates;
                const diffResult = calculateDiff([], finalResult);
                setDiff(diffResult);
                setMergedKnowledge(finalResult);
                setActiveStep(5);
                return;
            }

            // Step 3: Merge with existing library
            setLoadingMessage('ステップ3/3: AIが既存データと統合中...');
            const mergePrompt = `あなたは、既存の知識体系に新しい情報を統合する、優秀な知識ベースの編集者です。
# 指示
- 「既存の知識ライブラリ」と「追加候補」を意味や文脈レベルで比較し、重複する概念は統合し、新しい概念のみを追加してください。
- IDは既存のものを尊重し、新しい項目にのみユニークなIDを付与してください。
- 統合が完了した単一の知識ライブラリ全体のJSONのみを返してください。
# 既存の知識ライブラリ
${JSON.stringify(existingLibrary, null, 2)}
# 追加候補
${JSON.stringify(candidates, null, 2)}
# 出力形式
- 統合後の知識ライブラリ全体のJSON配列のみを出力してください。`;

            const mergedText = await gemini.generateContent(mergePrompt);
            const finalResult = extractJson(mergedText);
            const diffResult = calculateDiff(existingLibrary, finalResult);

            if (diffResult.newPhases.length === 0 && diffResult.updatedPhases.length === 0) {
                alert('AIは新しい知識を追加しませんでした。入力内容を変更して再度お試しください。');
                setActiveStep(3);
                return;
            }
            setDiff(diffResult);
            setMergedKnowledge(finalResult);
            setActiveStep(5);

        } catch (e) {
            console.error('AI generation/merge failed:', e);
            alert(`処理中にエラーが発生しました: ${e.message}`);
            setActiveStep(3);
        }
    };
    
    const calculateDiff = (before, after) => {
        const diff = { newPhases: [], updatedPhases: [] };
        const beforePhaseMap = new Map(before.map(p => [p.name, p]));

        after.forEach(afterPhase => {
            const beforePhase = beforePhaseMap.get(afterPhase.name);
            const afterKnowledgeCount = (afterPhase.knowledges?.length || 0) + (afterPhase.subPhases?.flatMap(sp => sp.knowledges || []).length || 0);
            
            if (afterKnowledgeCount === 0) return;

            if (!beforePhase) {
                diff.newPhases.push({ name: afterPhase.name, added: afterKnowledgeCount });
            } else {
                const beforeKnowledgeCount = (beforePhase.knowledges?.length || 0) + (beforePhase.subPhases?.flatMap(sp => sp.knowledges || []).length || 0);
                if (afterKnowledgeCount > beforeKnowledgeCount) {
                    diff.updatedPhases.push({ name: afterPhase.name, added: afterKnowledgeCount - beforeKnowledgeCount });
                }
            }
        });
        return diff;
    };

    const handleApply = () => {
        dispatch(setKnowledgeLibrary(mergedKnowledge));
        handleReset();
    };

    const renderStepContent = (step) => {
        switch (step) {
            case 0: return <TextField autoFocus label="あなたの業界を教えてください" fullWidth value={formData.industry} onChange={(e) => setFormData({ ...formData, industry: e.target.value })} placeholder="例: キャンピングカー販売"/>;
            case 1: return (
                    <Box>
                        <Typography gutterBottom>AIがあなたの業界の一般的な業務活動を提案します。合致するものを選んでください。（複数選択可）</Typography>
                        <Paper variant="outlined" sx={{ p: 1, mb: 2, minHeight: '100px' }}>
                            {suggestedActivities.map((act) => <Chip key={act} label={act} onClick={() => handleActivityToggle(act)} color={formData.activities.includes(act) ? 'primary' : 'default'} sx={{ m: 0.5 }} />)}
                        </Paper>
                        <TextField label="手動で追加" fullWidth value={activityInput} onChange={(e) => setActivityInput(e.target.value)} onKeyDown={handleActivityAdd} placeholder="入力してEnterキーで追加" />
                    </Box>
                );
            case 2: return (
                    <Box>
                        <Typography gutterBottom>
                            選択した業務活動に基づき、AIが顧客体験の流れをたたき台として提案しました。<br/>
                            これは後で**企業側のタスク（知識）に変換するための「材料」**です。ご自身のビジネスに合わせて修正してください。
                        </Typography>
                        <TextField label="顧客体験の主な流れ" fullWidth multiline rows={8} value={formData.customerFlow} onChange={(e) => setFormData({ ...formData, customerFlow: e.target.value })} />
                    </Box>
                );
            case 3: return <TextField label="補足事項" fullWidth multiline rows={4} value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="特に重視する業務などがあればご記入ください" />;
            case 4: return <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 4 }}><CircularProgress sx={{ mb: 2 }} /><Typography>{loadingMessage}</Typography></Box>;
            case 5: return (
                    <Box>
                         <Alert severity="success" sx={{ mb: 2 }}>
                            AIが既存の知識を分析し、以下のように統合しました。内容を確認し、問題なければ承認してください。
                         </Alert>
                         <Paper variant="outlined" sx={{ p: 2, overflow: 'auto', maxHeight: '40vh' }}>
                            {diff && (
                                <List dense>
                                    {diff.newPhases.map(p => (
                                        <ListItem key={p.name}>
                                            <ListItemIcon><AddCircleOutlineIcon color="success" /></ListItemIcon>
                                            <ListItemText primary={`フェーズ「${p.name}」が新しく追加されます。`} secondary={`${p.added}個の知識を含む`} />
                                        </ListItem>
                                    ))}
                                    {diff.updatedPhases.map(p => (
                                        <ListItem key={p.name}>
                                            <ListItemIcon><EditIcon color="info" /></ListItemIcon>
                                            <ListItemText primary={`フェーズ「${p.name}」に、新たに${p.added}個の知識が追加されます。`} />
                                        </ListItem>
                                    ))}
                                    {diff.newPhases.length === 0 && diff.updatedPhases.length === 0 && (
                                        <ListItem><ListItemText primary="変更はありませんでした。" /></ListItem>
                                    )}
                                </List>
                            )}
                         </Paper>
                    </Box>
                );
            default: return <Typography>不明なステップ</Typography>;
        }
    };

    return (
        <Modal open={open} onClose={onClose}>
            <Box sx={modalStyle}>
                <Typography variant="h5" component="h2" gutterBottom>ナレッジセットアップアシスタント {isInitialSetup ? '(初期設定)' : '(追加モード)'}</Typography>
                <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
                    {steps.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
                </Stepper>
                <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2, mb: 2, minHeight: '30vh' }}>
                    {isLoading && activeStep < 4 ? <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><CircularProgress sx={{mr: 2}}/> <Typography>{loadingMessage}</Typography></Box> : renderStepContent(activeStep)}
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'row', pt: 2 }}>
                    <Button color="inherit" disabled={activeStep === 0 || isLoading} onClick={handleBack} sx={{ mr: 1 }}>戻る</Button>
                    <Box sx={{ flex: '1 1 auto' }} />
                    <Button onClick={onClose} sx={{ mr: 1 }}>キャンセル</Button>
                    <Button onClick={handleNext} disabled={isLoading || (activeStep === 0 && !formData.industry) || (activeStep === 1 && formData.activities.length === 0)}>
                        {activeStep === steps.length - 1 ? '承認して保存する' : '次へ'}
                    </Button>
                </Box>
            </Box>
        </Modal>
    );
}

export default KnowledgeSetupAssistant;