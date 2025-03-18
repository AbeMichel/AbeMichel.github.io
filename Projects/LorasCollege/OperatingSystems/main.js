const setupInput = document.getElementById("setup-input");
const requestsInput = document.getElementById("requests-input");
requestsInput.disabled = true;

const stepSimBtn = document.getElementById("sim-step-btn");

async function LoadFile(file) {
    return new Promise((resolve, reject) => {
        if (!file) {
            resolve([false, ""]);
            return;
        }
        
            const reader = new FileReader();
            reader.onload = (e) => resolve([true, e.target.result]);
            reader.onerror = (e) => resolve([false, ""]);
            
            reader.readAsText(file);  // Loads the file
    });
}

async function SetupFile(file) {
    const [contentValid, rawContent] = await LoadFile(file);
    requestsInput.disabled = !contentValid;
    if (!contentValid) return;

    const splitLines = rawContent
    .split(/\r\n|\n/)
    .map(Number);

    // Should be 2 lines
    const ramSize = splitLines[0];
    const framePageSize = splitLines[1];

    return [ramSize, framePageSize];
}

async function RequestsFile(file) {
    const [contentValid, rawContent] = await LoadFile(file);
    if (!contentValid) return;

    const splitLines = rawContent
    .split(/\r\n|\n/)
    .map(Number);
    // First entry should be the number of requests
    const numRequests = splitLines[0];
    // Every subsequent 2 lines should be a process and the burst time
    let processes = [];
    for (let i = 1; i < splitLines.length; i += 2) {
        const memoryRequired = splitLines[i];
        const burstTime = splitLines[i+1];
        const newProcess = new Process(memoryRequired, burstTime);
        processes.push(newProcess);
    }

    return [numRequests, processes];
}

class PageTable {
    constructor(numPages, pageSize) {
        this.pageSize = pageSize;
        this.entries = [];
        for (let i = 0; i < numPages; i++) {
            this.entries.push(-1);
        }
    }

    GetPageCount() {
        return this.entries.length;
    }

    GetSize() {
        return this.GetPageCount() * this.pageSize;
    }

    StorePageLoc(pageNum, frameLoc) {
        this.entries[pageNum] = frameLoc;
    }

    StorePage(frameNo) {
        if (this.entries.length === 0) return -1;
        
        // Find the first unstored page
        for (let i = 0; i < this.entries.length; i++) {
            if (this.entries[i] === -1) {
                this.entries[i] = frameNo;
                return i;  // Return the page number that got stored
            }
        }

        // There were no other pages to store
        return -1;
    }

    PageUnloaded(pageNum) {
        this.entries[pageNum] = -1;
    }

    UnloadAll() {
        for (let i = 0; i < this.entries.length; i++) {
            this.PageUnloaded(i);
        }
    }

    Print() {
        //<table class="page-table">
        const newEl = document.createElement("table");
        newEl.classList.add("page-table");
        //  <tr><th>Page No</th><th>Frame No</th></tr>
        const headerRow = document.createElement("tr");
        newEl.appendChild(headerRow);
        const pageNumHeader = document.createElement("th");
        pageNumHeader.innerText = "Page #";
        headerRow.appendChild(pageNumHeader);
        const frameNumHeader = document.createElement("th");
        frameNumHeader.innerText = "Frame #";
        headerRow.appendChild(frameNumHeader);
        //  <tr><td>0</td><td>-1</td></tr>
        //  <tr><td>1</td><td>-1</td></tr>
        //  <tr><td>2</td><td>-1</td></tr>
        this.entries.forEach((frameLoc, pageNo) => {
            const row = document.createElement("tr");
            newEl.appendChild(row);
            const pageNumData = document.createElement("td");
            pageNumData.innerText = pageNo;
            row.appendChild(pageNumData);
            const frameNumData = document.createElement("td");
            frameNumData.innerText = frameLoc === -1 ? "-" : frameLoc;
            row.appendChild(frameNumData);
        });
        //</table>

        return newEl;
    }
}

class Process {
    static currentID = 0;
    static GetNewID() {
        return this.currentID++;
    }

    constructor(memoryRequired, burstTime) {
        this.id = Process.GetNewID();
        this.cycleProcessCompleted = -1;
        this.memoryRequired = memoryRequired;
        this.burstTime = burstTime;

        this.pageTable;
        this.active = false;
    }

    Initialize(pageSize) {
        const numPagesNeeded = Math.ceil(this.memoryRequired / pageSize);

        this.pageTable = new PageTable(numPagesNeeded, pageSize);
    }

    Load() {
        this.active = true;
    }

    Unload() {
        this.active = false;
        this.pageTable.UnloadAll();
    }

    Tick() {
        if (!this.active || this.IsComplete()) {
            console.error("Cannot tick an inactive or complete process.");
            return;
        }

        this.burstTime--;
    }

    IsComplete() { return !(this.burstTime > 0); }

    SetCompletedCycle(cycleNum) {
        this.cycleProcessCompleted = cycleNum;
    }

    GetNumPages() { return this.pageTable.GetPageCount() };

    StorePage(frameNo) {
        return this.pageTable.StorePage(frameNo);
    }

    Print() {
        //<div class="process">
        const newEl = document.createElement("div");
        newEl.classList.add("process");
        //     <div class="process-info">
        const processInfoEl = document.createElement("div");
        processInfoEl.classList.add("process-info");
        newEl.appendChild(processInfoEl);
        //         <div>ID: </div>
        const idEl = document.createElement("div");
        idEl.textContent = `ID: ${this.id}`;
        processInfoEl.appendChild(idEl);

        if (this.IsComplete()) {
            //         <div>Completed On Cycle: </div>
            const cycleEl = document.createElement("div");
            cycleEl.textContent = `Completed On Cycle: ${this.cycleProcessCompleted}`;
            processInfoEl.appendChild(cycleEl);
        }
        else {
            //         <div>Burst Time Remaining: </div>
            const burstEl = document.createElement("div");
            burstEl.textContent = `Burst Time: ${this.burstTime}`;
            processInfoEl.appendChild(burstEl);
        
            //         <div>Required Memory</div>
            const reqMemEl = document.createElement("div");
            reqMemEl.textContent = `Required Memory: ${this.memoryRequired}`;
            processInfoEl.appendChild(reqMemEl);
            //         <div>Page Table Size</div>
            if (this.active) {

                const ptsEl = document.createElement("div");
                ptsEl.textContent = `Page Table Size: ${this.pageTable.GetSize()}`;
                processInfoEl.appendChild(ptsEl);
                //     </div>
                //     <table class="page-table">
                //         <tr><th>Page No</th><th>Frame No</th></tr>
                //         <tr><td>0</td><td>-1</td></tr>
                //         <tr><td>1</td><td>-1</td></tr>
                //         <tr><td>2</td><td>-1</td></tr>
                //     </table>
                newEl.appendChild(this.pageTable.Print());
            }
        }
        // </div>

        return newEl;
    }
}

class RAM {
    constructor(sizeOfMem, frameSize) {
        this.mem = sizeOfMem;
        this.frameSize = frameSize;
        this.showAllFrames = false;
        this.numFrames = Math.floor(sizeOfMem / frameSize);
        this.frames = [];
        for (let i = 0; i < this.numFrames; i++) {
            // Frame # | Page # | ProcessID
            this.frames[i] = [i, -1, -1];
        }
    }

    LoadProcess(process) {
        // If there isn't enough room don't add the process
        if (process.GetNumPages() > this.GetFreeFrameCount()) return false;

        process.Load();
        // Otherwise, we can store each page into a frame
        for (let i = 0; i < this.numFrames; i++) {
            if (this.frames[i][2] === -1) {  // This frame is free
                const pageNo = process.StorePage(i);
                if (pageNo === -1) break;  // We are out of pages to store
                this.frames[i][1] = pageNo; 
                this.frames[i][2] = process.id;
            }
        }

        return true;
    }

    UnloadProcess(process) {
        // Free up any of the frames occupied by this
        const id = process.id;
        for (let i = 0; i < this.numFrames; i++) {
            if (this.frames[i][2] === id) {
                this.frames[i][1] = -1;
                this.frames[i][2] = -1;
            }
        }
        
        process.Unload();
    }

    GetLoadedProcessIDs() {
        const occupiedFrames = this.frames.filter(frame => frame[2] !== -1);
        let processIDs = [];
        occupiedFrames.forEach(frame => {
            processIDs.push(frame[2]);
        });
        return Array.from(new Set(processIDs));
    }

    GetFreeFrameCount() {
        return this.frames.filter(frame => frame[2] === -1).length;
    }

    GetOccupiedMemAmt() {
        // Find the number of frames occupied * frame size
        const occupiedFrameCount = this.frames.filter(frame => frame[2] !== -1).length;
        return [occupiedFrameCount, occupiedFrameCount * this.frameSize];
    }

    Print() {
        // <div id="frames">
        const framesEl = document.getElementById("frames");
        framesEl.innerHTML = "";
        //     <div>
        const infoEl = document.createElement("div");
        framesEl.appendChild(infoEl);
        //         <div id="frames-ratio">Frame/Page Size:</div>
        const frameSizeEl = document.createElement("div");
        frameSizeEl.id = "frames-size";
        infoEl.appendChild(frameSizeEl);
        frameSizeEl.innerText = `Frame/Page Size: ${this.frameSize}`
        //         <div id="frames-ratio">Frames (Free/Total):</div>
        const framesRatioEl = document.createElement("div");
        framesRatioEl.id = "frames-ratio";
        infoEl.appendChild(framesRatioEl);
        framesRatioEl.innerText = `Frames (Free/Total): ${this.GetFreeFrameCount()}/${this.numFrames}`
        //         <div id="frames-ratio">Memory (Free/Total):</div>
        const memRatioEl = document.createElement("div");
        memRatioEl.id = "mem-ratio";
        infoEl.appendChild(memRatioEl);
        memRatioEl.innerText = `Memory (Free/Total): ${this.GetFreeFrameCount() * this.frameSize}/${this.numFrames * this.frameSize}`
        //         <div id="num-processes">Number of Processes:</div>
        const numProcessesEl = document.createElement("div");
        numProcessesEl.id = "num-processes";
        infoEl.appendChild(numProcessesEl);
        numProcessesEl.innerText = `Number of Processes Loaded: ${this.GetLoadedProcessIDs().length}`
        //     </div>
        //     <div>
        const tableDiv = document.createElement("div");
        tableDiv.id = "table-div";
        framesEl.appendChild(tableDiv);
        //          <table>
        const tableEl = document.createElement("table");
        tableDiv.appendChild(tableEl);
        //              <thead>
        const theader = document.createElement("thead");
        tableEl.appendChild(theader);
        //                  <tr><th>Frame No</th><th>Page No</th><th>Process ID</th></tr>
        const tableHeader = document.createElement("tr");
        theader.appendChild(tableHeader);
        const frameNoHeader = document.createElement("th");
        frameNoHeader.textContent = "Frame #";
        tableHeader.appendChild(frameNoHeader);
        const pageNoHeader = document.createElement("th");
        pageNoHeader.textContent = "Page #";
        tableHeader.appendChild(pageNoHeader);
        const processIdHeader = document.createElement("th");
        processIdHeader.textContent = "Process ID";
        tableHeader.appendChild(processIdHeader);
        //              </thead>
        //              <tbody>
        const tbody = document.createElement("tbody");
        tableEl.appendChild(tbody);
        //                  <tr><td>0</td><td>-1</td><td>-1</td></tr>
        //                  <tr><td>1</td><td>-1</td><td>-1</td></tr>
        //                  <tr><td>2</td><td>-1</td><td>-1</td></tr>
        this.frames.forEach(frame => {
            if ((frame[2] === -1) && !this.showAllFrames) return;  // Don't print empty frames
            const row = document.createElement("tr");
            tbody.appendChild(row);
            const frameNoData = document.createElement("td");
            frameNoData.textContent = frame[0];
            row.appendChild(frameNoData);
            const pageNoData = document.createElement("td");
            pageNoData.textContent = frame[1] === -1 ? "-" : frame[1];
            row.appendChild(pageNoData);
            const processIdData = document.createElement("td");
            processIdData.textContent = frame[2] === -1 ? "-" :  frame[2];
            row.appendChild(processIdData);
        });
        //              <tbody>
        //          </table>
        //      </div>
        // </div>
        
        return framesEl;
    }
}

class OS {
    constructor() {
        this.ram = null;
        this.processes = [];   
        this.cycle = -1;     
    }

    SetRAM(ram) {
        this.ram = ram;
        requestsInput.disabled = !(this.ram);
        this.Print();
    }

    AddRequest(request, printAfter=true) {
        // Store it
        request.Initialize(this.ram.frameSize);
        this.processes.push(request);
        if (printAfter) this.Print();
    }

    AddRequests(requests) {
        requests.forEach(r => {
            this.AddRequest(r, false);
        });

        this.Print();
    }

    Tick() {
        if (!this.ram) return;
        this.cycle++;

        // Tick all the processes in RAM
        const loadedIDs = this.ram.GetLoadedProcessIDs();
        const loadedProcesses = this.processes.filter(p => loadedIDs.includes(p.id));
        let completeProcesses = [];
        loadedProcesses.forEach(p => {
            p.Tick();
            if (p.IsComplete()) completeProcesses.push(p);
        });

        // Check if any are done
        // If they are then we can unload their resources
        completeProcesses.forEach(p => {
            p.SetCompletedCycle(this.cycle);
            this.ram.UnloadProcess(p);
        });
        
        // Try to put other processes into RAM
        const inactiveAndIncompleteProcesses = this.processes.filter(p => !p.IsComplete() && !p.active);
        inactiveAndIncompleteProcesses.forEach(p => {
            this.ram.LoadProcess(p);
        });
        
        this.Print();
    }

    Reset() {}

    Print() {
        // <div id="display">
        //     <div id="state">
        //         <p>Cycle: </p>
        const cycleInfo = document.querySelector("#state p");
        cycleInfo.innerText = `Cycle: ${this.cycle}`;
        //     </div>
        //     <div id="content">
        const contentEl = document.getElementById("content");
        if (this.ram) contentEl.appendChild(this.ram.Print());
        //         ...
        //         <div id="processes">
        //             <div id="active">
        //                 <p>Active</p>
        //                 <div class="process-container">
        const activeProcessEl = document.querySelector("#active .process-container");
        activeProcessEl.innerHTML = "";
        const activeProcesses = this.processes.filter(p => p.active);
        activeProcesses.forEach(p => { activeProcessEl.appendChild(p.Print()); });
        //                     ...
        //                 </div>
        //             </div>
        //             <div id="inactive">
        //                 <p>Inactive</p>
        //                 <div class="process-container">
        const inactiveProcessEl = document.querySelector("#inactive .process-container");
        inactiveProcessEl.innerHTML = "";
        const inactiveProcesses = this.processes.filter(p => !p.active && !p.IsComplete());
        inactiveProcesses.forEach(p => { inactiveProcessEl.appendChild(p.Print()); });
        //                 ...
        //                 </div>
        //             </div>
        //             <div id="completed">
        //                 <p>Completed</p>
        //                 <div class="process-container">
        const completeProcessEl = document.querySelector("#completed .process-container");
        completeProcessEl.innerHTML = "";
        const completeProcesses = this.processes.filter(p => p.IsComplete());
        completeProcesses.forEach(p => { completeProcessEl.appendChild(p.Print()); });
        //                 ...
        //                 </div>
        //             </div>
        //         </div>
        //     </div>
        // </div>
    }
}

const os = new OS();

setupInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    let [ramSize, frameSize] = await SetupFile(file);
    const newRAM = new RAM(ramSize, frameSize);
    os.SetRAM(newRAM);
});
requestsInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    const [valid, newProcesses] = await RequestsFile(file);
    if (valid) {
        os.AddRequests(newProcesses);
    } else {
        // Do some error stuff here maybe
        console.error("Requests file is invalid.");
    }
});
stepSimBtn.addEventListener("click", e => {
    os.Tick();
});

function openProcessPopup() {
    document.getElementById("process-id").innerText = Process.currentID;
    document.getElementById("popup-process").style.display = "block";
    document.getElementById("popupOverlay").style.display = "block";
}

function closeProcessPopup() {
    document.getElementById("popup-process").style.display = "none";
    document.getElementById("popupOverlay").style.display = "none";
}

function submitProcess() {
    let num1 = document.getElementById("num1").value;
    let unit = document.getElementById("unit").value;
    let num2 = document.getElementById("num2").value;
    
    if (num1 && num2 && os){
        var newProcess = new Process(multiplyByUnit(num1, unit), num2);
        os.AddRequest(newProcess);
    }
    
    closeProcessPopup();
}

function openSetupPopup() {
    document.getElementById("process-id").innerText = Process.currentID;
    document.getElementById("popup-setup").style.display = "block";
    document.getElementById("popupOverlay").style.display = "block";
}

function closeSetup() {
    document.getElementById("popup-setup").style.display = "none";
    document.getElementById("popupOverlay").style.display = "none";
}

function submitSetup() {
    let num1 = document.getElementById("num12").value;
    let unit1 = document.getElementById("unit2").value;

    let num2 = document.getElementById("num22").value;
    let unit2 = document.getElementById("unit22").value;
    
    if (num1 && num2 && os){
        var ramSize = multiplyByUnit(num1, unit1);
        var pageFrameSize = multiplyByUnit(num2, unit2);
        const newRam = new RAM(ramSize, pageFrameSize);
        os.SetRAM(newRam);
    }
    
    closeSetup();
}

function multiplyByUnit(num, unit) {
    let multiplier = 1;
    switch (unit) {
        case "KB":
            multiplier = 1_000;
            break;
        case "MB":
            multiplier = 1_000_000;
            break;
        case "GB":
            multiplier = 1_000_000_000;
            break;        
        case "B":
        default:
            break;
    }

    return num * multiplier;
}

function toggleAllFrames() {
    if (os && os.ram){
        os.ram.showAllFrames = !os.ram.showAllFrames;
        os.Print();
    }
}

let intervalID;

function playSim() {
    if (!(os && os.ram)) return;

    pauseSim();

    intervalID = setInterval(() => {
        const incompleteProcessCount = os.processes.filter(p => !p.IsComplete()).length;
        os.Tick();
        if (incompleteProcessCount === 0) pauseSim();
    }, 1000);
}

function pauseSim() {
    if (intervalID) {
        clearInterval(intervalID);
        intervalID = null;
    }
}