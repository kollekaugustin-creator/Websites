// Klare deutsche Fehlermeldungen im Kontaktformular.
// Ohne JavaScript prüft der Browser die Pflichtfelder selbst.
document.addEventListener("DOMContentLoaded", function () {
  var form = document.querySelector(".contact-form");
  if (!form) return;

  form.setAttribute("novalidate", "");
  var fields = form.querySelectorAll("[data-error]");

  function clearError(field) {
    var wrap = field.closest(".field");
    var msg = wrap.querySelector(".field-error");
    if (msg) msg.remove();
    wrap.classList.remove("has-error");
    field.removeAttribute("aria-invalid");
    field.removeAttribute("aria-describedby");
  }

  function showError(field) {
    var wrap = field.closest(".field");
    var msg = document.createElement("p");
    msg.className = "field-error";
    msg.id = field.id + "-fehler";
    msg.textContent = field.getAttribute("data-error");
    wrap.appendChild(msg);
    wrap.classList.add("has-error");
    field.setAttribute("aria-invalid", "true");
    field.setAttribute("aria-describedby", msg.id);
  }

  form.addEventListener("submit", function (e) {
    var firstInvalid = null;
    fields.forEach(function (field) {
      clearError(field);
      if (!field.checkValidity()) {
        showError(field);
        if (!firstInvalid) firstInvalid = field;
      }
    });
    if (firstInvalid) {
      e.preventDefault();
      firstInvalid.focus();
    }
  });

  fields.forEach(function (field) {
    field.addEventListener("input", function () {
      if (field.checkValidity()) clearError(field);
    });
  });
});
