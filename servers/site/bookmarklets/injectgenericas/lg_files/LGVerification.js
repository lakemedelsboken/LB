function sendDisapprovalMail() {
    var form = document.forms[0];

    var el = document.createElement("input");
    el.type="hidden";
    el.name="approvalmode";
    el.value="disapprove";
    form.appendChild(el);

    el = document.createElement("input");
    el.type="hidden";
    el.name="disapprovalreason";
    el.value=document.getElementById("disapprovalReason").value;
    form.appendChild(el);

    form.submit();
}
function approvalClick() {
    var form = document.forms[0];

    var el = document.createElement("input");
    el.type="hidden";
    el.name="approvalmode";
    el.value="approve";
    form.appendChild(el);
    form.submit();
}

