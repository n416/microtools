import React from 'react';
import { useSelector } from 'react-redux';
import { Paper, Typography, Box, List, ListItem, ListItemText, Button } from '@mui/material';
import { useDrag } from 'react-dnd';
import ArticleIcon from '@mui/icons-material/Article';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';

function FlowItem({ flow }) {
    const [{ isDragging }, drag] = useDrag(() => ({
        type: 'flow',
        item: { id: flow.id },
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
            <ListItemText primary={flow.name} secondary={flow.description} />
        </ListItem>
    );
}

function FlowListPane({ onStartAiDesign }) {
    const { flowLibrary } = useSelector(state => state.case);
    const { categories, selectedCategoryId } = useSelector(state => state.flowCategory);

    const filteredFlows = flowLibrary.filter(wf => wf.categoryId === selectedCategoryId);
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
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="h6">
                    フローリスト: {selectedCategory.name}
                </Typography>
                <Button variant="outlined" size="small" startIcon={<AutoFixHighIcon />} onClick={onStartAiDesign}>
                    AIで新しいフローを設計
                </Button>
            </Box>
            <Box sx={{ overflow: 'auto', flexGrow: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                {filteredFlows.length > 0 ? (
                    <List>
                        {filteredFlows.map(flow => (
                            <FlowItem key={flow.id} flow={flow} />
                        ))}
                    </List>
                ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                        <Typography color="text.secondary">このカテゴリにはフローがありません。</Typography>
                    </Box>
                )}
            </Box>
        </Paper>
    );
}

export default FlowListPane;