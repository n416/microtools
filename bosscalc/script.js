document.addEventListener("DOMContentLoaded", () => {
    createContributionInputs();
    loadValues();
    document.querySelectorAll("input").forEach(input => {
      input.addEventListener("input", () => {
        setManual(input);
        validateInputs();
        saveValues();
        calculateHP();
      });
    });
  });
  
  function createContributionInputs() {
    const container = document.getElementById("contributionInputs");
    for (let i = 1; i <= 10; i++) {
      const entry = document.createElement("div");
      entry.className = "item-entry";
      entry.innerHTML = `
        <label><span>${i}位の貢献度 (%)</span><input type="number" step="0.1" id="rank${i}" data-manual="false"></label>
        <span class="status" id="status${i}">auto</span>
        <button onclick="clearInput(${i})">クリア</button>
      `;
      container.appendChild(entry);
    }
  }
  
  function loadValues() {
    const participantInput = document.getElementById("participants");
    participantInput.value = localStorage.getItem("participants") || "200";
  
    for (let i = 1; i <= 10; i++) {
      const input = document.getElementById(`rank${i}`);
      if (input) {
        input.value = localStorage.getItem(`rank${i}`) || "";
        input.dataset.manual = localStorage.getItem(`rank${i}_manual`) || "false";
        updateStatus(i);
      }
    }
  
    const myRankInput = document.getElementById("myRank");
    myRankInput.value = localStorage.getItem("myRank") || "100";
  
    const myContributionInput = document.getElementById("myContribution");
    myContributionInput.value = localStorage.getItem("myContribution") || "0.1";
  }
  
  function saveValues() {
    localStorage.setItem("participants", document.getElementById("participants").value);
  
    for (let i = 1; i <= 10; i++) {
      const input = document.getElementById(`rank${i}`);
      if (input) {
        localStorage.setItem(`rank${i}`, input.value);
        localStorage.setItem(`rank${i}_manual`, input.dataset.manual);
        updateStatus(i);
      }
    }
  
    localStorage.setItem("myRank", document.getElementById("myRank").value);
    localStorage.setItem("myContribution", document.getElementById("myContribution").value);
  }
  
  function updateStatus(rank) {
    const input = document.getElementById(`rank${rank}`);
    const status = document.getElementById(`status${rank}`);
    if (status) {
      status.textContent = input.dataset.manual === "true" ? "✓" : "auto";
    }
  }
  
  function setManual(input) {
    if (input.dataset.manual === "false") {
      input.dataset.manual = "true";
      updateStatus(parseInt(input.id.replace("rank", "")));
    }
  }
  
  function clearInput(rank) {
    const input = document.getElementById(`rank${rank}`);
    if (input) {
      input.value = "";
      input.dataset.manual = "false";
      saveValues();
      calculateHP();
    }
  }
  
  function clearAll() {
    localStorage.clear();
    loadValues();
    document.getElementById("bossHP").textContent = "--";
    document.getElementById("calculation").textContent = "--";
  }
  
  function validateInputs() {
    for (let i = 2; i <= 10; i++) {
      const currentInput = document.getElementById(`rank${i}`);
      const previousInput = document.getElementById(`rank${i - 1}`);
      if (currentInput && previousInput && currentInput.dataset.manual === "true" && previousInput.dataset.manual === "true") {
        if (parseFloat(currentInput.value) > parseFloat(previousInput.value)) {
          currentInput.value = previousInput.value;
        }
      }
      if (currentInput && parseFloat(currentInput.value) < 0) {
        currentInput.value = 0;
      }
    }
  }
  
  function calculateHP() {
    const participants = parseInt(document.getElementById("participants").value);
    const contributions = [];
    for (let i = 1; i <= 10; i++) {
      const input = document.getElementById(`rank${i}`);
      if (input) {
        const value = parseFloat(input.value);
        if (!isNaN(value)) {
          contributions[i - 1] = value;
        }
      }
    }
  
    for (let i = 1; i < 10; i++) {
      const currentInput = document.getElementById(`rank${i + 1}`);
      if (currentInput && currentInput.dataset.manual === "false") {
        const prev = contributions[i - 1] || 0;
        const next = contributions.slice(i + 1).find(val => val !== undefined) || 0;
        contributions[i] = (prev + next) / 2;
        currentInput.value = contributions[i].toFixed(1);
        currentInput.dataset.manual = "false";
        updateStatus(i + 1);
      }
    }
  
    const myRank = parseInt(document.getElementById("myRank").value);
    const myContribution = parseFloat(document.getElementById("myContribution").value);
  
    const topContributorsSum = contributions.reduce((sum, val) => sum + val, 0);
    const remainingContributorsSum = myContribution * (participants - 10);
    const totalContribution = topContributorsSum + remainingContributorsSum;
  
    const bossHP = 100 - totalContribution;
    document.getElementById("bossHP").textContent = bossHP.toFixed(1);
    document.getElementById("calculation").textContent = `100 - (${topContributorsSum.toFixed(1)} + ${remainingContributorsSum.toFixed(1)}) = ${bossHP.toFixed(1)}%`;
  }
  