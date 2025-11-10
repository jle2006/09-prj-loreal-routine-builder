/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* Load product data from JSON file */
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
}

/* Create HTML for displaying product cards */
function displayProducts(products) {
  productsContainer.innerHTML = products
    .map(
      (product) => `
    <div class="product-card">
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.brand}</p>
      </div>
    </div>
  `
    )
    .join("");
}

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", async (e) => {
  const products = await loadProducts();
  const selectedCategory = e.target.value;

  /* filter() creates a new array containing only products 
     where the category matches what the user selected */
  const filteredProducts = products.filter(
    (product) => product.category === selectedCategory
  );

  displayProducts(filteredProducts);
});

/* Helper: send messages to your server proxy which calls the OpenAI API */
async function fetchOpenAIFromServer(messages) {
  // POST the messages to your server endpoint that has the API key
  const res = await fetch("/openai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });

  const data = await res.json();
  // Expect server to return the raw OpenAI response JSON (or at least choices)
  // Guard for expected structure
  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error("Unexpected OpenAI response shape");
  }
  return data.choices[0].message.content;
}

/* Replace the placeholder chat handler with a real one */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  // Collect user input (assumes a textarea/input with id="chatInput")
  const input = document.getElementById("chatInput");
  const userText = input.value.trim();
  if (!userText) return;

  // Show user's message in chat window
  const userHtml = `<div class="chat-message user"><strong>You:</strong> ${userText}</div>`;
  chatWindow.innerHTML += userHtml;
  input.value = "";

  // Build messages array for Chat API (system + user messages)
  const messages = [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: userText },
  ];

  // Show a "thinking" message while waiting
  const thinkingId = `thinking-${Date.now()}`;
  chatWindow.innerHTML += `<div id="${thinkingId}" class="chat-message assistant">Thinking...</div>`;
  chatWindow.scrollTop = chatWindow.scrollHeight;

  try {
    const assistantText = await fetchOpenAIFromServer(messages);

    // Replace the thinking message with the assistant response
    const thinkingEl = document.getElementById(thinkingId);
    if (thinkingEl) {
      thinkingEl.outerHTML = `<div class="chat-message assistant"><strong>Assistant:</strong> ${assistantText}</div>`;
    } else {
      chatWindow.innerHTML += `<div class="chat-message assistant"><strong>Assistant:</strong> ${assistantText}</div>`;
    }
    chatWindow.scrollTop = chatWindow.scrollHeight;
  } catch (err) {
    const thinkingEl = document.getElementById(thinkingId);
    if (thinkingEl)
      thinkingEl.outerHTML = `<div class="chat-message assistant error">Error: ${err.message}</div>`;
    else
      chatWindow.innerHTML += `<div class="chat-message assistant error">Error: ${err.message}</div>`;
    console.error(err);
  }
});
