// Turns the booking form into a three-step form. Without this script the
// whole form shows at once and still submits normally.
const form = document.querySelector(".booking");

if (form) {
  const steps = [...form.querySelectorAll(".step")];
  const marks = [...form.querySelectorAll(".progress li")];
  const back = form.querySelector("[data-back]");
  const next = form.querySelector("[data-next]");
  const send = form.querySelector("[data-send]");
  const last = steps.length - 1;
  let current = 0;

  // no booking in the past; en-CA formats the local date as YYYY-MM-DD
  form.elements.date.min = new Date().toLocaleDateString("en-CA");

  // the Book buttons on the home page link here with ?class=lunch and so on
  const wanted = new URLSearchParams(location.search).get("class");
  const preset = form.querySelector(`input[name="class"][value="${CSS.escape(wanted ?? "")}"]`);
  if (preset) preset.checked = true;

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

  function advance() {
    const invalid = [...steps[current].querySelectorAll("input, textarea")].find(
      (field) => !field.checkValidity(),
    );
    if (invalid) {
      invalid.reportValidity();
      return;
    }
    go(current + 1, "forward");
  }

  next.addEventListener("click", advance);
  back.addEventListener("click", () => go(current - 1, "back"));

  const error = form.querySelector(".booking__error");
  const done = document.querySelector(".booking__done");
  const layout = form.closest(".booking-layout");
  const bound = document.querySelectorAll("[data-bind]");

  const guests = form.elements.guests;
  const guestsHint = document.getElementById("guests-hint");
  const guestRules = {
    private: { min: 2, max: 2, hint: "Private classes are for two guests." },
    group: { min: 7, max: "", hint: "Groups start at seven guests. Tell us your numbers in the notes." },
  };

  // the guest count follows the class: two for a private class, seven or more for a group
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

  // the ticket beside the form mirrors the answers so far
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
    if (event.target.name === "class") syncGuests();
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

  // Enter inside a field moves on instead of sending half a form
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (current < last) {
      advance();
      return;
    }

    error.hidden = true;
    send.disabled = true;

    try {
      const response = await fetch(form.action, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new FormData(form),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message);

      // show the thank-you message here, so the site stays at two pages
      layout.hidden = true;
      done.hidden = false;
      done.focus();
    } catch {
      error.hidden = false;
      send.disabled = false;
    }
  });

  // arriving from a Book button means the class is already chosen, so start on the date step
  show(preset ? 1 : 0);
}
