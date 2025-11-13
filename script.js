/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const chatInput = document.getElementById("userInput");

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

// Selected products state (persisted in localStorage)
let selectedProducts = [];

// Chat context (keeps all messages for follow-up)
let chatMessages = [
  { role: "system", content: "You are a helpful assistant." }
];

// Load selected products from localStorage
function loadSelectedProducts() {
  const saved = localStorage.getItem("selectedProducts");
  selectedProducts = saved ? JSON.parse(saved) : [];
}

// Save selected products to localStorage
function saveSelectedProducts() {
  localStorage.setItem("selectedProducts", JSON.stringify(selectedProducts));
}

// Load product data from JSON file
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
}

// Update the selected products list in the UI
function updateSelectedProductsList(products) {
  const list = document.getElementById("selectedProductsList");
  if (!list) return;
  if (selectedProducts.length === 0) {
    list.innerHTML = `<div class="placeholder-message">No products selected yet.</div>`;
    return;
  }
  list.innerHTML = selectedProducts
    .map((id) => {
      const product = products.find((p) => p.id === id);
      if (!product) return "";
      return `
        <div class="selected-product-card">
          <img src="${product.image}" alt="${product.name}" width="50">
          <div>
            <strong>${product.name}</strong><br>
            <span>${product.brand}</span>
          </div>
          <button class="remove-selected-btn" data-id="${product.id}">Remove</button>
        </div>
      `;
    })
    .join("");
}

// Show product details (simple alert for now)
function showProductDetails(product) {
  alert(
    `Product: ${product.name}\nBrand: ${product.brand}\nCategory: ${product.category}\n\n${product.description}`
  );
}

// Create HTML for displaying product cards
function displayProducts(products) {
  productsContainer.innerHTML = products
    .map((product) => {
      const isSelected = selectedProducts.includes(product.id);
      return `
        <div class="product-card">
          <img src="${product.image}" alt="${product.name}">
          <div class="product-info">
            <h3>${product.name}</h3>
            <p>${product.brand}</p>
            <button class="select-btn" data-id="${product.id}">
              ${isSelected ? "Deselect" : "Select"}
            </button>
            <button class="details-btn" data-id="${product.id}">Details</button>
          </div>
        </div>
      `;
    })
    .join("");

  // Add event listeners for select/deselect and details buttons
  const selectBtns = document.querySelectorAll(".select-btn");
  selectBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.getAttribute("data-id"));
      if (selectedProducts.includes(id)) {
        selectedProducts = selectedProducts.filter((pid) => pid !== id);
      } else {
        selectedProducts.push(id);
      }
      saveSelectedProducts();
      displayProducts(products);
      updateSelectedProductsList(products);
    });
  });

  const detailsBtns = document.querySelectorAll(".details-btn");
  detailsBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.getAttribute("data-id"));
      const product = products.find((p) => p.id === id);
      if (product) showProductDetails(product);
    });
  });
}

// Use Cloudflare Worker for OpenAI requests
async function fetchOpenAIFromServer(messages) {
  const res = await fetch("https://loreal-routine-builder.lejenna737.workers.dev/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  const data = await res.json();
  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error("Unexpected OpenAI response shape");
  }
  return data.choices[0].message.content;
}

// Filter and display products when category changes
categoryFilter.addEventListener("change", async (e) => {
  const products = await loadProducts();
  const selectedCategory = e.target.value;
  const filteredProducts = products.filter(
    (product) => product.category === selectedCategory
  );
  displayProducts(filteredProducts);
  updateSelectedProductsList(products);

  // Add remove button listeners for selected products
  const list = document.getElementById("selectedProductsList");
  if (list) {
    list.addEventListener("click", (ev) => {
      if (ev.target.classList.contains("remove-selected-btn")) {
        const id = Number(ev.target.getAttribute("data-id"));
        selectedProducts = selectedProducts.filter((pid) => pid !== id);
        saveSelectedProducts();
        displayProducts(filteredProducts);
        updateSelectedProductsList(filteredProducts);
      }
    });
  }
});

// Handle chat form submission
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const userText = chatInput.value.trim();
  if (!userText) return;

  // Show user's message in chat window
  const userHtml = `<div class="chat-message user"><strong>You:</strong> ${userText}</div>`;
  chatWindow.innerHTML += userHtml;
  chatInput.value = "";

  // Add user message to chat context
  chatMessages.push({ role: "user", content: userText });

  // Show a "thinking" message while waiting
  const thinkingId = `thinking-${Date.now()}`;
  chatWindow.innerHTML += `<div id="${thinkingId}" class="chat-message assistant">Thinking...</div>`;
  chatWindow.scrollTop = chatWindow.scrollHeight;

  try {
    const assistantText = await fetchOpenAIFromServer(chatMessages);
    chatMessages.push({ role: "assistant", content: assistantText });
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

// Generate routine button logic
const generateBtn = document.getElementById("generateRoutine");
generateBtn.addEventListener("click", async () => {
  const products = await loadProducts();
  if (selectedProducts.length === 0) {
    chatWindow.innerHTML += `<div class="chat-message assistant error">Please select products before generating a routine.</div>`;
    return;
  }
  // Build a message describing the selected products
  const selected = selectedProducts
    .map((id) => {
      const p = products.find((prod) => prod.id === id);
      if (!p) return "";
      return `${p.name} (${p.brand}): ${p.description}`;
    })
    .join("\n\n");

  const routinePrompt = `Create a skincare/haircare/makeup routine using only these products. List steps and explain why each is used.\n\n${selected}`;
  chatMessages.push({ role: "user", content: routinePrompt });

  // Show a "thinking" message
  const thinkingId = `thinking-${Date.now()}`;
  chatWindow.innerHTML += `<div id="${thinkingId}" class="chat-message assistant">Thinking...</div>`;
  chatWindow.scrollTop = chatWindow.scrollHeight;

  try {
    const assistantText = await fetchOpenAIFromServer(chatMessages);
    chatMessages.push({ role: "assistant", content: assistantText });
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

// On page load, restore selected products and update UI
window.addEventListener("DOMContentLoaded", async () => {
  loadSelectedProducts();
  const products = await loadProducts();
  updateSelectedProductsList(products);
});
