// Question Renderer for LTA Questionnaire
class LTAQuestionRenderer {
    constructor() {
        this.currentQuestion = null;
    }

    // Main render method
    renderQuestion(question, currentResponse = null) {
        this.currentQuestion = question;
        const container = document.createElement('div');
        container.className = 'question-card';
        container.dataset.questionId = question.id;

        // Add question header
        container.appendChild(this.renderQuestionHeader(question));

        // Add question content based on type
        switch (question.type) {
            case 'single-select':
                container.appendChild(this.renderSingleSelect(question, currentResponse));
                break;
            case 'multiple-select':
                container.appendChild(this.renderMultipleSelect(question, currentResponse));
                break;
            case 'matrix':
                container.appendChild(this.renderMatrix(question, currentResponse));
                break;
            case 'likert-scale':
                container.appendChild(this.renderLikertScale(question, currentResponse));
                break;
            case 'ranking':
                container.appendChild(this.renderRanking(question, currentResponse));
                break;
            case 'open-ended':
                container.appendChild(this.renderOpenEnded(question, currentResponse));
                break;
            default:
                container.appendChild(this.renderSingleSelect(question, currentResponse));
        }

        return container;
    }

    renderQuestionHeader(question) {
        const header = document.createElement('div');
        header.className = 'question-header';

        const questionText = document.createElement('div');
        questionText.className = 'question-text';
        questionText.textContent = question.text;

        const rationale = document.createElement('div');
        rationale.className = 'question-rationale';
        rationale.textContent = question.rationale;

        header.appendChild(questionText);
        header.appendChild(rationale);

        return header;
    }

    renderSingleSelect(question, currentResponse) {
        const container = document.createElement('div');
        container.className = 'input-group';

        question.options.forEach(option => {
            const optionValue = typeof option === 'object' ? option.value : option;
            const optionText = typeof option === 'object' ? option.text : option;
            
            const label = document.createElement('label');
            label.className = 'option-label';
            if (currentResponse && currentResponse.value === optionValue) {
                label.classList.add('selected');
            }

            const input = document.createElement('input');
            input.type = 'radio';
            input.name = question.id;
            input.value = optionValue;
            input.className = 'option-input';
            if (currentResponse && currentResponse.value === optionValue) {
                input.checked = true;
            }

            const textSpan = document.createElement('span');
            textSpan.textContent = optionText;

            label.appendChild(input);
            label.appendChild(textSpan);

            // Add input field if required
            if (typeof option === 'object' && option.requiresInput) {
                const inputField = document.createElement('input');
                inputField.type = 'text';
                inputField.placeholder = 'Please specify...';
                inputField.className = 'specify-input';
                inputField.style.marginLeft = '10px';
                inputField.style.marginTop = '5px';
                inputField.style.width = 'calc(100% - 30px)';
                
                if (currentResponse && currentResponse.specify) {
                    inputField.value = currentResponse.specify;
                }

                label.appendChild(inputField);
            }

            container.appendChild(label);

            // Add event listener
            input.addEventListener('change', () => {
                document.querySelectorAll(`label.option-label`).forEach(l => l.classList.remove('selected'));
                label.classList.add('selected');
            });
        });

        return container;
    }

    renderMultipleSelect(question, currentResponse) {
        const container = document.createElement('div');
        container.className = 'input-group';

        const selectedValues = currentResponse ? currentResponse.values || [] : [];

        question.options.forEach(option => {
            const optionValue = typeof option === 'object' ? option.value : option;
            const optionText = typeof option === 'object' ? option.text : option;
            
            const label = document.createElement('label');
            label.className = 'option-label';
            if (selectedValues.includes(optionValue)) {
                label.classList.add('selected');
            }

            const input = document.createElement('input');
            input.type = 'checkbox';
            input.name = question.id;
            input.value = optionValue;
            input.className = 'option-input';

            const textSpan = document.createElement('span');
            textSpan.textContent = optionText;

            label.appendChild(input);
            label.appendChild(textSpan);

            // Add input field if required
            if (typeof option === 'object' && option.requiresInput) {
                const inputField = document.createElement('input');
                inputField.type = 'text';
                inputField.placeholder = 'Please specify...';
                inputField.className = 'specify-input';
                inputField.style.marginLeft = '10px';
                inputField.style.marginTop = '5px';
                inputField.style.width = 'calc(100% - 30px)';
                
                label.appendChild(inputField);
            }

            container.appendChild(label);

            // Add event listener
            input.addEventListener('change', () => {
                if (input.checked) {
                    label.classList.add('selected');
                } else {
                    label.classList.remove('selected');
                }
            });
        });

        return container;
    }

    renderMatrix(question, currentResponse) {
        const container = document.createElement('div');
        container.className = 'matrix-container';

        const table = document.createElement('table');
        table.className = 'matrix-grid';

        // Create header row
        const headerRow = document.createElement('tr');
        headerRow.className = 'matrix-header';
        
        // Empty cell for row labels
        const emptyHeader = document.createElement('th');
        headerRow.appendChild(emptyHeader);

        // Column headers
        question.columns.forEach(column => {
            const th = document.createElement('th');
            th.textContent = column;
            headerRow.appendChild(th);
        });

        table.appendChild(headerRow);

        // Create data rows
        question.rows.forEach(row => {
            const tr = document.createElement('tr');
            tr.className = 'matrix-row';

            // Row label
            const rowLabel = document.createElement('td');
            rowLabel.className = 'matrix-label';
            rowLabel.textContent = row;
            tr.appendChild(rowLabel);

            // Radio buttons for each column
            question.columns.forEach(column => {
                const td = document.createElement('td');
                td.className = 'matrix-option';

                const input = document.createElement('input');
                input.type = 'radio';
                input.name = `${question.id}_${row.replace(/\s+/g, '_')}`;
                input.value = column;

                if (currentResponse && currentResponse[row] === column) {
                    input.checked = true;
                }

                td.appendChild(input);
                tr.appendChild(td);
            });

            table.appendChild(tr);
        });

        container.appendChild(table);
        return container;
    }

    renderLikertScale(question, currentResponse) {
        const container = document.createElement('div');
        container.className = 'likert-container';

        const scale = document.createElement('div');
        scale.className = 'likert-scale';

        question.options.forEach(option => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'likert-option';

            const input = document.createElement('input');
            input.type = 'radio';
            input.name = question.id;
            input.value = option.value || option;
            input.className = 'likert-input';

            if (currentResponse && currentResponse.value === (option.value || option)) {
                input.checked = true;
            }

            const label = document.createElement('div');
            label.className = 'likert-label';
            label.textContent = option.label || option;

            optionDiv.appendChild(input);
            optionDiv.appendChild(label);
            scale.appendChild(optionDiv);
        });

        container.appendChild(scale);
        return container;
    }

    renderRanking(question, currentResponse) {
        const container = document.createElement('div');
        container.className = 'ranking-container';

        const itemsContainer = document.createElement('div');
        itemsContainer.id = `ranking-${question.id}`;
        itemsContainer.className = 'ranking-items';

        const items = currentResponse && currentResponse.ranking ? 
            currentResponse.ranking : 
            [...question.options];

        items.forEach((item, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'ranking-item';
            itemDiv.draggable = true;
            itemDiv.dataset.value = typeof item === 'object' ? item.value : item;

            const handle = document.createElement('span');
            handle.className = 'ranking-handle';
            handle.textContent = '☰';

            const number = document.createElement('div');
            number.className = 'ranking-number';
            number.textContent = index + 1;

            const text = document.createElement('span');
            text.textContent = typeof item === 'object' ? item.text : item;

            itemDiv.appendChild(handle);
            itemDiv.appendChild(number);
            itemDiv.appendChild(text);
            itemsContainer.appendChild(itemDiv);
        });

        // Add drag and drop functionality
        this.makeSortable(itemsContainer);

        container.appendChild(itemsContainer);
        return container;
    }

    renderOpenEnded(question, currentResponse) {
        const container = document.createElement('div');
        container.className = 'open-ended-container';

        let inputElement;
        
        if (question.inputType === 'textarea') {
            inputElement = document.createElement('textarea');
            inputElement.rows = 6;
            inputElement.placeholder = question.placeholder || 'Please provide your response...';
        } else {
            inputElement = document.createElement('input');
            inputElement.type = 'text';
            inputElement.placeholder = question.placeholder || 'Your response...';
        }

        inputElement.className = 'open-ended-input';
        inputElement.style.width = '100%';
        inputElement.style.padding = '10px';
        inputElement.style.border = '1px solid var(--border-color)';
        inputElement.style.borderRadius = 'var(--radius-md)';

        if (currentResponse && currentResponse.value) {
            inputElement.value = currentResponse.value;
        }

        container.appendChild(inputElement);
        return container;
    }

    makeSortable(container) {
        let draggedItem = null;

        container.querySelectorAll('.ranking-item').forEach(item => {
            item.addEventListener('dragstart', function() {
                draggedItem = this;
                setTimeout(() => this.style.opacity = '0.4', 0);
            });

            item.addEventListener('dragend', function() {
                setTimeout(() => this.style.opacity = '1', 0);
                draggedItem = null;
            });

            item.addEventListener('dragover', function(e) {
                e.preventDefault();
            });

            item.addEventListener('dragenter', function(e) {
                e.preventDefault();
                this.style.backgroundColor = 'var(--light-green)';
            });

            item.addEventListener('dragleave', function() {
                this.style.backgroundColor = '';
            });

            item.addEventListener('drop', function(e) {
                e.preventDefault();
                this.style.backgroundColor = '';
                if (draggedItem && this !== draggedItem) {
                    const allItems = Array.from(container.querySelectorAll('.ranking-item'));
                    const thisIndex = allItems.indexOf(this);
                    const draggedIndex = allItems.indexOf(draggedItem);
                    
                    if (draggedIndex < thisIndex) {
                        this.parentNode.insertBefore(draggedItem, this.nextSibling);
                    } else {
                        this.parentNode.insertBefore(draggedItem, this);
                    }
                    
                    // Update numbers
                    container.querySelectorAll('.ranking-item').forEach((item, idx) => {
                        item.querySelector('.ranking-number').textContent = idx + 1;
                    });
                }
            });
        });
    }

    // Get response from rendered question
    getResponse(question) {
        const container = document.querySelector(`[data-question-id="${question.id}"]`);
        if (!container) return null;

        switch (question.type) {
            case 'single-select':
                return this.getSingleSelectResponse(container, question);
            case 'multiple-select':
                return this.getMultipleSelectResponse(container, question);
            case 'matrix':
                return this.getMatrixResponse(container, question);
            case 'likert-scale':
                return this.getLikertResponse(container, question);
            case 'ranking':
                return this.getRankingResponse(container, question);
            case 'open-ended':
                return this.getOpenEndedResponse(container, question);
            default:
                return null;
        }
    }

    getSingleSelectResponse(container, question) {
        const selectedInput = container.querySelector('input[type="radio"]:checked');
        if (!selectedInput) return null;

        const response = {
            value: selectedInput.value,
            questionId: question.id,
            section: question.section
        };

        // Check if there's a specify input
        const specifyInput = selectedInput.parentElement.querySelector('.specify-input');
        if (specifyInput && specifyInput.value) {
            response.specify = specifyInput.value;
        }

        return response;
    }

    getMultipleSelectResponse(container, question) {
        const checkedInputs = container.querySelectorAll('input[type="checkbox"]:checked');
        if (checkedInputs.length === 0) return null;

        const values = Array.from(checkedInputs).map(input => input.value);
        const response = {
            values: values,
            questionId: question.id,
            section: question.section
        };

        // Collect specify inputs
        const specifyData = {};
        checkedInputs.forEach(input => {
            const specifyInput = input.parentElement.querySelector('.specify-input');
            if (specifyInput && specifyInput.value) {
                specifyData[input.value] = specifyInput.value;
            }
        });

        if (Object.keys(specifyData).length > 0) {
            response.specify = specifyData;
        }

        return response;
    }

    getMatrixResponse(container, question) {
        const response = {
            questionId: question.id,
            section: question.section,
            matrix: {}
        };

        question.rows.forEach(row => {
            const rowName = row.replace(/\s+/g, '_');
            const selectedInput = container.querySelector(`input[name="${question.id}_${rowName}"]:checked`);
            if (selectedInput) {
                response.matrix[row] = selectedInput.value;
            }
        });

        return Object.keys(response.matrix).length > 0 ? response : null;
    }

    getLikertResponse(container, question) {
        const selectedInput = container.querySelector('input[type="radio"]:checked');
        return selectedInput ? {
            value: selectedInput.value,
            questionId: question.id,
            section: question.section
        } : null;
    }

    getRankingResponse(container, question) {
        const items = container.querySelectorAll('.ranking-item');
        const ranking = Array.from(items).map(item => item.dataset.value);
        
        return ranking.length > 0 ? {
            ranking: ranking,
            questionId: question.id,
            section: question.section
        } : null;
    }

    getOpenEndedResponse(container, question) {
        const input = container.querySelector('.open-ended-input');
        const value = input ? input.value.trim() : '';
        
        return value ? {
            value: value,
            questionId: question.id,
            section: question.section
        } : null;
    }
}

// Create global instance
const LTA_RENDERER = new LTAQuestionRenderer();
