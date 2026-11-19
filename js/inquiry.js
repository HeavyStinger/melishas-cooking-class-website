// Sends the general inquiry form without leaving the page, with a message under
// each field that needs fixing. Without this script the form posts normally.
const form = document.querySelector(".inquiry__form");

if (form) {
  const send = form.querySelector("[data-send]");
  const status = form.querySelector("[data-status]");
  const error = form.querySelector(".booking__error");
  const done = document.querySelector(".inquiry__done");
  const sendLabel = send.textContent;
  const fields = [...form.querySelectorAll("input[required], textarea[required]")];

  // the messages below replace the browser's own validation bubbles
  form.noValidate = true;

  const missing = {
    name: "Enter your name.",
    email: "Enter your email address.",
    message: "Write your question or message.",
  };

  function problem(field) {
    if (field.validity.valid) return "";
    if (field.validity.valueMissing) return missing[field.name];
    if (field.validity.typeMismatch) return "That email address doesn't look right.";
    return field.validationMessage;
  }

  // one message element per field, made the first time it is needed
  function messageFor(field) {
    const holder = field.closest(".field");
    let message = holder.querySelector(".field__error");
    if (!message) {
      message = document.createElement("p");
      message.className = "field__error";
      message.id = `inquiry-${field.name}-error`;
      message.hidden = true;
      message.innerHTML = '<i class="bi bi-exclamation-circle-fill" aria-hidden="true"></i><span></span>';
      holder.append(message);
    }
    return message;
  }

  // returns true when the field is fine; otherwise shows the message under it
  function check(field) {
    const text = problem(field);
    const message = messageFor(field);
    message.querySelector("span").textContent = text;
    message.hidden = !text;
    if (text) {
      field.setAttribute("aria-invalid", "true");
      field.setAttribute("aria-describedby", message.id);
    } else {
      field.removeAttribute("aria-invalid");
      field.removeAttribute("aria-describedby");
    }
    return !text;
  }

  // a message goes away as soon as the field is fixed, and a finished field is checked on leaving it
  form.addEventListener("input", (event) => {
    if (event.target.hasAttribute("aria-invalid")) check(event.target);
  });

  form.addEventListener("focusout", (event) => {
    if (fields.includes(event.target) && event.target.value) check(event.target);
  });

  function setSending(on) {
    form.classList.toggle("is-sending", on);
    form.setAttribute("aria-busy", String(on));
    fields.forEach((field) => (field.disabled = on));
    send.disabled = on;
    send.textContent = on ? "Sending…" : sendLabel;
    status.textContent = on ? "Sending your message…" : "";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const bad = fields.filter((field) => !check(field))[0];
    if (bad) {
      bad.focus();
      return;
    }

    error.hidden = true;
    const body = new FormData(form); // read before the fields are disabled
    setSending(true);

    try {
      const response = await fetch(form.action, {
        method: "POST",
        headers: { Accept: "application/json" },
        body,
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message);

      form.hidden = true;
      done.hidden = false;
      done.focus();
    } catch {
      setSending(false);
      error.hidden = false;
      error.scrollIntoView({ block: "nearest" });
    }
  });
}
