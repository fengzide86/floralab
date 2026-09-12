(function () {
  'use strict';
  function open({ title, body, confirm = '确定', onConfirm }) {
    const previous = document.activeElement,
      dialog = document.createElement('dialog');
    dialog.className = 'workflow-dialog';
    const heading = document.createElement('h2');
    heading.textContent = title;
    heading.id = 'workflowDialogTitle';
    dialog.setAttribute('aria-labelledby', heading.id);
    dialog.append(heading);
    const content = document.createElement('div');
    content.className = 'dialog-body';
    content.innerHTML = body;
    dialog.append(content);
    const error = document.createElement('p');
    error.className = 'dialog-error';
    error.setAttribute('role', 'alert');
    dialog.append(error);
    const actions = document.createElement('div');
    actions.className = 'dialog-actions';
    const cancel = document.createElement('button');
    cancel.textContent = '取消';
    cancel.className = 'secondary';
    const accept = document.createElement('button');
    accept.textContent = confirm;
    accept.className = 'primary';
    accept.id = 'dialogConfirm';
    actions.append(cancel, accept);
    dialog.append(actions);
    const close = () => {
      dialog.close();
      dialog.remove();
      previous?.focus();
    };
    cancel.onclick = close;
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      if (!accept.disabled) close();
    });
    accept.onclick = async () => {
      accept.disabled = true;
      cancel.disabled = true;
      error.textContent = '';
      try {
        await onConfirm(dialog);
        close();
      } catch (e) {
        error.textContent = e.message || '操作没有完成，请重试';
        accept.disabled = false;
        cancel.disabled = false;
      }
    };
    document.body.append(dialog);
    dialog.showModal();
    const first = dialog.querySelector(
      'input:not([type=file]),textarea,select'
    );
    if (first) first.focus();
    else cancel.focus();
    return dialog;
  }
  globalThis.FloraLabDialog = { open };
})();
