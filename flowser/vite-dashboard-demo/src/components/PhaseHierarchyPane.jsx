import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Paper, Typography, Box } from '@mui/material';
import { selectPhase, selectSubPhase, moveKnowledge } from '../store/knowledgeSlice';
import { useDrop } from 'react-dnd';

const itemSx = {
  display: 'flex',
  alignItems: 'center',
  p: '6px 8px',
  cursor: 'pointer',
  borderRadius: 1,
  transition: 'background-color 0.2s, border 0.2s',
  // ▼▼▼ 【修正】常に2pxの透明な点線ボーダーを持つように変更 ▼▼▼
  border: '2px dashed transparent',
};

function DroppableHierarchyItem({ children, phaseId, subPhaseId = null, selected, isAncestor, onClick }) {
    const dispatch = useDispatch();
    const [{ isOver, canDrop }, drop] = useDrop(() => ({
        accept: 'knowledge',
        drop: (item) => {
            dispatch(moveKnowledge({
                knowledgeId: item.id,
                source: item.source,
                target: { phaseId, subPhaseId }
            }));
        },
        collect: (monitor) => ({
            isOver: monitor.isOver(),
            canDrop: monitor.canDrop(),
        }),
    }), [phaseId, subPhaseId]);

    return (
        <Box
            ref={drop}
            onClick={onClick}
            sx={{
                ...itemSx,
                backgroundColor: selected
                    ? 'rgba(25, 118, 210, 0.08)'
                    : isAncestor
                    ? 'action.hover'
                    : 'transparent',
                color: 'text.primary',
                // ▼▼▼ 【修正】ドラッグ開始時(canDrop)に点線を表示し、重なった時(isOver)に色を変えるロジック ▼▼▼
                borderColor: isOver ? 'primary.main' : canDrop ? '#ccc' : 'transparent',
                '&:hover': {
                    backgroundColor: 'action.hover',
                }
            }}
        >
            {children}
        </Box>
    );
}

function PhaseHierarchyPane() {
  const dispatch = useDispatch();
  const { library, selectedPhaseId, selectedSubPhaseId } = useSelector(state => state.knowledge);

  return (
    <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h6" gutterBottom>① 階層管理エリア</Typography>
      <Box sx={{ overflow: 'auto', flexGrow: 1, mt: 1 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {library.map(phase => {
            const isDirectlySelected = selectedPhaseId === phase.id && !selectedSubPhaseId;
            const isAncestorOfSelected = selectedPhaseId === phase.id && !!selectedSubPhaseId;

            return (
              <React.Fragment key={phase.id}>
                <DroppableHierarchyItem
                  phaseId={phase.id}
                  selected={isDirectlySelected}
                  isAncestor={isAncestorOfSelected}
                  onClick={() => dispatch(selectPhase(phase.id))}
                >
                  <Typography variant="body2" sx={{ fontWeight: selectedPhaseId === phase.id ? 'bold' : 'normal' }}>
                    {phase.name}
                  </Typography>
                </DroppableHierarchyItem>

                {phase.subPhases.map(subPhase => (
                  <Box key={subPhase.id} sx={{ pl: 4 }}>
                    <DroppableHierarchyItem
                      phaseId={phase.id}
                      subPhaseId={subPhase.id}
                      selected={selectedSubPhaseId === subPhase.id}
                      isAncestor={false}
                      onClick={() => dispatch(selectSubPhase(subPhase.id))}
                    >
                      <Typography variant="body2">
                        {subPhase.name}
                      </Typography>
                    </DroppableHierarchyItem>
                  </Box>
                ))}
              </React.Fragment>
            )
          })}
        </Box>
      </Box>
    </Paper>
  );
}

export default PhaseHierarchyPane;