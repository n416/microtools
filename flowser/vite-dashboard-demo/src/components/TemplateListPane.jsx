import React from 'react';
import { useSelector } from 'react-redux';
import { Paper, Typography, Box, List, ListItem, ListItemText } from '@mui/material';
import { useDrag } from 'react-dnd'; // DndProvider を削除
// import { HTML5Backend } from 'react-dnd-html5-backend'; // 削除
import ArticleIcon from '@mui/icons-material/Article';

// ドラッグ可能なテンプレート項目
function TemplateItem({ template }) {
    const [{ isDragging }, drag] = useDrag(() => ({
        type: 'template',
        item: { id: template.id },
        collect: (monitor) => ({
            isDragging: !!monitor.isDragging(),
        }),
    }));

    return (
        <ListItem
            ref={drag}
            sx={{
                cursor: 'move',
                opacity: isDragging ? 0.5 : 1,
                border: '1px solid #ddd',
                borderRadius: 1,
                mb: 1,
                bgcolor: 'background.paper'
            }}
        >
            <ArticleIcon sx={{ mr: 1.5 }} color="action" />
            <ListItemText primary={template.name} secondary={template.description} />
        </ListItem>
    );
}

function TemplateListPane() {
    const { workflowLibrary } = useSelector(state => state.workflow);
    const { categories, selectedCategoryId } = useSelector(state => state.workflowCategory);

    const filteredTemplates = workflowLibrary.filter(wf => wf.categoryId === selectedCategoryId);
    const selectedCategory = categories.find(c => c.id === selectedCategoryId);

    if (!selectedCategory) {
        return (
            <Paper sx={{ p: 2, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography color="text.secondary">カテゴリを選択してください。</Typography>
            </Paper>
        );
    }

    return (
        <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" gutterBottom>
                テンプレートリスト: {selectedCategory.name}
            </Typography>
            <Box sx={{ overflow: 'auto', flexGrow: 1, p: 1, bgcolor: 'grey.100', borderRadius: 1 }}>
                {filteredTemplates.length > 0 ? (
                    <List>
                        {filteredTemplates.map(template => (
                            <TemplateItem key={template.id} template={template} />
                        ))}
                    </List>
                ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                        <Typography color="text.secondary">このカテゴリにはテンプレートがありません。</Typography>
                    </Box>
                )}
            </Box>
        </Paper>
    );
}

// ▼▼▼ ラッパーを削除し、コンポーネントを直接エクスポート ▼▼▼
export default TemplateListPane;