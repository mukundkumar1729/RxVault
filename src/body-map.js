// ════════════════════════════════════════════════════════════
//  BODY-MAP.JS — Interaction logic for the Human Body Map
// ════════════════════════════════════════════════════════════

function initBodyMap() {
    const container = document.getElementById('bodyMapContainer');

    if (!container) return;

    // Add Clear Button if not exists
    if (!document.getElementById('bodyMapClearBtn')) {
        const header = container.querySelector('.body-map-container > div');
        if (header) {
            const clearBtn = document.createElement('button');
            clearBtn.id = 'bodyMapClearBtn';
            clearBtn.innerHTML = '✕ Clear Map';
            clearBtn.className = 'body-map-clear-btn';
            clearBtn.onclick = resetBodyMap;
            header.appendChild(clearBtn);
        }
    }

    const bodyParts = document.querySelectorAll('.human-body-svg .body-part');
    const diagInput = document.getElementById('fDiagnosis'); 

    if (!diagInput || !bodyParts.length) return;

    bodyParts.forEach(part => {
        // Remove existing listener to prevent duplicates if re-initted
        const nextPart = part.cloneNode(true);
        part.parentNode.replaceChild(nextPart, part);

        nextPart.addEventListener('click', () => {
            const label = nextPart.getAttribute('data-label');
            nextPart.classList.toggle('selected');
            
            updateDiagnosisFromMap();
        });
    });
}

function updateDiagnosisFromMap() {
    const diagInput = document.getElementById('fDiagnosis');
    if (!diagInput) return;

    const selectedParts = Array.from(document.querySelectorAll('.human-body-svg .body-part.selected'))
        .map(p => p.getAttribute('data-label'));
    
    let currentVal = diagInput.value.trim();
    // Get non-map existing text (if any)
    // For now, let's just sync the whole thing to keep it simple, 
    // or smartly append. Smartly syncing is better.
    
    // Simple approach: append new ones, remove old ones.
    // Better approach: build a set of all body map labels, remove them from current text, 
    // and then re-add only the currently selected ones.
    
    const allLabels = Array.from(document.querySelectorAll('.human-body-svg .body-part'))
        .map(p => p.getAttribute('data-label'));
    
    let parts = currentVal.split(/,\s*|\n/).map(t => t.trim()).filter(Boolean);
    
    // Remove all possible body map labels from existing list
    parts = parts.filter(p => !allLabels.includes(p));
    
    // Add currently selected ones
    const finalParts = [...parts, ...selectedParts];
    
    diagInput.value = finalParts.join(', ');
    diagInput.dispatchEvent(new Event('input'));
}

// Reset body map highlights and sync with diagnosis field
function resetBodyMap() {
    const bodyParts = document.querySelectorAll('.human-body-svg .body-part');
    bodyParts.forEach(part => part.classList.remove('selected'));
    
    // If called from clear button, we also want to remove symptoms from the text field
    updateDiagnosisFromMap();
}
