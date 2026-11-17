// Turns the booking form into a three-step form. Without this script the
// whole form shows at once and still submits normally.
const form = document.querySelector(".booking");

if (form) {
  const steps = [...form.querySelectorAll(".step")];
  const marks = [...form.querySelectorAll(".progress li")];
  const back = form.querySelector("[data-back]");
  const next = form.querySelector("[data-next]");
  const send = form.querySelector("[data-send]");
  const status = form.querySelector("[data-status]");
  const error = form.querySelector(".booking__error");
  const done = document.querySelector(".booking__done");
  const layout = form.closest(".booking-layout");
  const bound = document.querySelectorAll("[data-bind]");
  const guests = form.elements.guests;
  const guestsHint = document.getElementById("guests-hint");
  const sendLabel = send.textContent;
  const last = steps.length - 1;
  let current = 0;

  // the messages below replace the browser's own validation bubbles
  form.noValidate = true;

  // no booking in the past; en-CA formats the local date as YYYY-MM-DD
  form.elements.date.min = new Date().toLocaleDateString("en-CA");

  // the Book buttons on the home page link here with ?class=lunch and so on
  const wanted = new URLSearchParams(location.search).get("class");
  const preset = form.querySelector(`input[name="class"][value="${CSS.escape(wanted ?? "")}"]`);
  if (preset) preset.checked = true;

  /* ---------- steps ---------- */

  function show(index) {
    current = index;
    steps.forEach((step, i) => (step.hidden = i !== current));
    marks.forEach((mark, i) => {
      mark.classList.toggle("is-done", i < current);
      if (i === current) mark.setAttribute("aria-current", "step");
      else mark.removeAttribute("aria-current");
    });
    back.hidden = current === 0;
    next.hidden = current === last;
    send.hidden = current !== last;
  }

  function go(index, direction) {
    show(index);
    form.dataset.direction = direction;
    steps[current].focus({ preventScroll: true });
    form.querySelector(".progress").scrollIntoView({ block: "nearest" });
  }

  /* ---------- error states ---------- */

  const missing = {
    class: "Pick a class to continue.",
    date: "Choose the date you'd like to come.",
    guests: "Enter how many guests.",
    name: "Enter your name.",
    email: "Enter your email address.",
  };

  function problem(field) {
    const { validity } = field;
    if (validity.valid) return "";
    if (validity.valueMissing) return missing[field.name];
    if (validity.typeMismatch) return "That email address doesn't look right.";
    if (validity.badInput) return "That doesn't look like a valid date.";
    if (validity.rangeUnderflow) {
      if (field.type === "date") return "Choose today or a later date.";
      return Number(field.min) > 1 ? `Groups start at ${field.min} guests.` : "Enter at least 1 guest.";
    }
    return field.validationMessage;
  }

  // one message element per field, made the first time it is needed
  function messageFor(field) {
    const radios = field.type === "radio";
    const anchor = radios ? field.closest(".picks") : field.closest(".field");
    let message = radios ? anchor.nextElementSibling : anchor.querySelector(".field__error");
    if (!message?.matches(".field__error")) {
      message = document.createElement("p");
      message.className = "field__error";
      message.id = `${field.name}-error`;
      message.hidden = true;
      message.innerHTML = '<i class="bi bi-exclamation-circle-fill" aria-hidden="true"></i><span></span>';
      if (radios) anchor.after(message);
      else anchor.append(message);
    }
    return message;
  }

  function describedBy(control, id, on) {
    const ids = new Set((control.getAttribute("aria-describedby") ?? "").split(" ").filter(Boolean));
    if (on) ids.add(id);
    else ids.delete(id);
    if (ids.size) control.setAttribute("aria-describedby", [...ids].join(" "));
    else control.removeAttribute("aria-describedby");
  }

  // returns true when the field is fine; otherwise shows the message under it
  function check(field) {
    const text = problem(field);
    const message = messageFor(field);
    const group = field.type === "radio" ? [...form.elements.class] : [field];

    message.querySelector("span").textContent = text;
    message.hidden = !text;
    group.forEach((control) => {
      if (text) control.setAttribute("aria-invalid", "true");
      else control.removeAttribute("aria-invalid");
      describedBy(control, message.id, Boolean(text));
    });
    if (field.type === "radio") field.closest(".picks").classList.toggle("is-invalid", Boolean(text));
    return !text;
  }

  // checks every field in a step and returns the first one with a problem
  function firstInvalid(index) {
    const fields = [...steps[index].querySelectorAll("input, textarea")].filter(
      (field) => field.type !== "radio" || field === form.elements.class[0],
    );
    return fields.filter((field) => !check(field))[0] ?? null;
  }

  function advance() {
    const bad = firstInvalid(current);
    if (bad) bad.focus();
    else go(current + 1, "forward");
  }

  next.addEventListener("click", advance);
  back.addEventListener("click", () => go(current - 1, "back"));

  // a message goes away as soon as the field is fixed, and a finished field is checked on leaving it
  form.addEventListener("input", (event) => {
    if (event.target.hasAttribute("aria-invalid")) check(event.target);
  });

  form.addEventListener("focusout", (event) => {
    const field = event.target;
    if (field.matches("input:not([type='radio']), textarea") && field.value) check(field);
  });

  /* ---------- guests follow the class ---------- */

  const guestRules = {
    private: { min: 2, max: 2, hint: "Private classes are for two guests." },
    group: { min: 7, max: "", hint: "Groups start at seven guests. Tell us your numbers in the notes." },
  };

  // two for a private class, seven or more for a group
  function syncGuests() {
    const rule = guestRules[form.elements.class.value] ?? { min: 1, max: "", hint: "" };
    const wasSpecial = Number(guests.min) > 1;
    guests.min = rule.min;
    guests.max = rule.max;
    guests.readOnly = rule.min === rule.max;
    guestsHint.textContent = rule.hint;
    guestsHint.hidden = !rule.hint;
    if (rule.min === rule.max) guests.value = rule.min;
    else if (wasSpecial && rule.min === 1) guests.value = 1; // back to a normal class: start from one again
    else guests.value = Math.max(Number(guests.value), rule.min);
  }

  /* ---------- the ticket beside the form ---------- */

  const pickedRadio = () => [...form.elements.class].find((radio) => radio.checked);
  const picked = () => pickedRadio()?.closest("label");

  // US$50 (BZ$100) is per person, so the total follows the guest count; a private class is one flat price
  function total() {
    const radio = pickedRadio();
    if (!radio?.dataset.usd) return null;
    const perPerson = "perPerson" in radio.dataset;
    return {
      perPerson,
      count: perPerson ? Math.max(Number(guests.value) || 1, 1) : 1,
      usd: Number(radio.dataset.usd),
      bzd: Number(radio.dataset.bzd),
    };
  }

  const squash = (text) => text.replace(/\s+/g, " ").trim();

  function describe(key) {
    if (key === "class") return picked()?.querySelector(".pick__name").textContent ?? "";
    if (key === "price") {
      const sum = total();
      if (sum) return "US$" + sum.usd * sum.count + " · BZ$" + sum.bzd * sum.count;
      return picked()?.querySelector(".pick__price").textContent ?? "";
    }
    if (key === "priceNote") {
      const sum = total();
      return sum?.perPerson ? sum.count + " × US$" + sum.usd + " per person" : "";
    }
    if (key === "time") {
      const label = picked();
      if (!label) return "";
      const time = label.querySelector(".pick__time");
      return time ? squash(time.textContent) : "Time to confirm";
    }
    const field = form.elements[key];
    if (!field.value) return "";
    if (field.type === "date") {
      return new Date(`${field.value}T00:00`).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
    }
    if (field.name === "guests") return `${field.value} ${field.value === "1" ? "guest" : "guests"}`;
    return field.value;
  }

  function priceSpan(className, text) {
    const span = document.createElement("span");
    span.className = className;
    span.textContent = text;
    return span;
  }

  function updateTicket() {
    bound.forEach((el) => {
      const value = describe(el.dataset.bind) || el.dataset.empty;
      const [usd, bzd] = value.split(" · ");

      // prices read "US$50 · BZ$100"; the BZ amount is set smaller
      if (el.dataset.bind === "price" && bzd) {
        el.replaceChildren(priceSpan("price__usd", usd), priceSpan("price__bzd", bzd));
      } else {
        el.textContent = value;
      }
      el.hidden = !value;
    });

    // so the booking email shows what the ticket showed
    form.elements.estimated_total.value = describe("price");
  }

  form.addEventListener("input", updateTicket);
  form.addEventListener("change", (event) => {
    if (event.target.name === "class") {
      syncGuests();
      if (form.elements.class[0].hasAttribute("aria-invalid")) check(form.elements.class[0]);
      if (guests.hasAttribute("aria-invalid")) check(guests);
    }
    updateTicket();
  });
  syncGuests();
  updateTicket();

  // choosing a class with a click or tap moves straight on; arrow keys only change the selection
  form.addEventListener("click", (event) => {
    if (!event.target.closest(".pick") || event.detail === 0) return;
    const from = current;
    setTimeout(() => {
      if (current === from) advance();
    }, 250);
  });

  /* ---------- sending ---------- */

  function setSending(on) {
    form.classList.toggle("is-sending", on);
    form.setAttribute("aria-busy", String(on));
    steps.forEach((step) => (step.disabled = on));
    back.disabled = on;
    send.disabled = on;
    send.textContent = on ? "Sending…" : sendLabel;
    status.textContent = on ? "Sending your request…" : "";
  }

  // Enter inside a field moves on instead of sending half a form
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (current < last) {
      advance();
      return;
    }

    // check every step, in case an earlier answer was edited after going back
    for (let i = 0; i <= last; i++) {
      const bad = firstInvalid(i);
      if (bad) {
        if (i !== current) go(i, "back");
        bad.focus();
        return;
      }
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

      // show the thank-you message here, so the site stays at two pages
      layout.hidden = true;
      done.hidden = false;
      done.focus();
    } catch {
      setSending(false);
      error.hidden = false;
      error.scrollIntoView({ block: "nearest" });
    }
  });

  // arriving from a Book button means the class is already chosen, so start on the date step
  show(preset ? 1 : 0);
}
