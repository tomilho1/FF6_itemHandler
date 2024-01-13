const fs = require('fs');

const { toHex, readLE } = require('./hex-utils')

/**
 * Slices a buffer into an array of items.
 * @param {*} buffer Buffer to be sliced.
 * @param {*} chunkSize Bytes per entry in the table.
 * @param {*} entries Length of the array.
 * @returns 
 */
function splitBuffer(buffer, chunkSize, entries = buffer.length/chunkSize) {
    let array = []
    for (let i = 0; i < entries; i++) {
        let c = i * chunkSize
        array.push(buffer.subarray(c, c + chunkSize))
    }
    return array
}

class ItemHandler {
    constructor(
        romPath = __dirname + '/ff3.smc',

        ptr_itemData = 0x185000,
        ptr_nameData = 0x12B300,
        ptr_descPointers = 0x2D7AA0,
        ptr_throwData = 0x110040,
        ptr_wpnAnimData = 0x2CE408
    ) {
        this.ROM = fs.readFileSync(romPath);

        this.ptr_itemData = ptr_itemData
        this.ptr_nameData = ptr_nameData
        this.ptr_descPointers = ptr_descPointers
        this.ptr_throwData = ptr_throwData + 1 // + 1 to ignore the first byte, that represents emptiness I guess.
                                               // That way, byte 00 represents item 00, and so on.
        this.ptr_wpnAnimData = ptr_wpnAnimData

        this.itemData = this.ROM.subarray(ptr_itemData, ptr_itemData + 256 * 30)
        this.nameData = this.ROM.subarray(ptr_nameData, ptr_nameData + 256 * 13)
        this.descPointers = this.ROM.subarray(ptr_descPointers, ptr_descPointers + 256 * 2)
        this.throwData = this.ROM.subarray(ptr_throwData, ptr_throwData + 256 * 1)
        this.wpnAnimData = this.ROM.subarray(ptr_wpnAnimData, ptr_wpnAnimData + 256 * 8)
    }

    getArrays() {
        const itemArray = splitBuffer(this.itemData, 30, 256)
        const nameArray = splitBuffer(this.nameData, 13, 256)
        const descPtrsArray = splitBuffer(this.descPointers, 2, 256)
        const throwArray = splitBuffer(this.throwData, 1, 256)
        const wpnAnimArray = splitBuffer(this.wpnAnimData, 8, 256)

        return [itemArray, nameArray, descPtrsArray, throwArray, wpnAnimArray]
    }

    saveArraysToRom([itemArray, nameArray, descPtrsArray, throwArray, wpnAnimArray], weaponMode) {
        this.itemData = Buffer.concat(itemArray)
        this.nameData = Buffer.concat(nameArray)
        this.descPointers = Buffer.concat(descPtrsArray)
        this.throwData = Buffer.concat(throwArray)

        this.ROM.set(this.itemData, this.ptr_itemData)
        this.ROM.set(this.nameData, this.ptr_nameData)
        this.ROM.set(this.descPointers, this.ptr_descPointers)
        this.ROM.set(this.throwData, this.ptr_throwData)

        if (weaponMode) {
            this.wpnAnimData = Buffer.concat(wpnAnimArray)
            this.ROM.set(this.wpnAnimData, this.ptr_wpnAnimData)
        }
    }

    extractItem(id, itemName) {
        const itemTables = this.getArrays()

        let desiredItem = []
        for (let i = 0; i < itemTables.length; i++) {
            desiredItem.push(itemTables[i][id])
        }

        fs.writeFileSync(__dirname + `/${itemName}.json`, JSON.stringify(desiredItem, null, 1))
    }

    /**
     * Replace one item of the ROM.
     * @param {*} weaponMode Must be set to true only when injecting an item to an
     * index below 93 (weapon), or else some attack animations will get corrupted.
     */
    injectItem(filePath, id, weaponMode = false) {
        const itemTables = this.getArrays()

        let bufferObject = fs.readFileSync(filePath)
        bufferObject = JSON.parse(bufferObject)

        let newItem = []
        bufferObject.forEach(buf => {
            newItem.push(Buffer.from(buf))
        })

        for (let i = 0; i < itemTables.length; i++) {
            itemTables[i][id] = newItem[i]
        }

        this.saveArraysToRom(itemTables, weaponMode)
    }

    /**
     * Copy all item related data of one index to another.
     * @param {*} weaponMode Must be set to true only when dealing with items below
     * index 93 (weapons), or else some attack animations will get corrupted.
     */
    copyItem(copyId, pasteId, weaponMode = false) {
        const itemTables = this.getArrays()

        for (let i = 0; i < itemTables.length; i++) {
            itemTables[i][pasteId] = itemTables[i][copyId]
        }

        this.saveArraysToRom(itemTables, weaponMode)
    }

    /**
     * Swap all item related data of two items around.
     * @param {*} weaponMode Must be set to true only when dealing with items below
     * index 93 (weapons), or else some attack animations will get corrupted.
     */
    swapItem(id1, id2, weaponMode = false) {
        const itemTables = this.getArrays()

        for (let i = 0; i < itemTables.length; i++) {
            let aux = itemTables[i][id2]

            itemTables[i][id2] = itemTables[i][id1]
            itemTables[i][id1] = aux
        }

        this.saveArraysToRom(itemTables, weaponMode)
    }

    /**
     * @param {*} weaponMode Must be set to true only when dealing with items below
     * index 93 (weapons), or else some attack animations will get corrupted.
     */
    moveItem(fromId, toId, weaponMode = false) {
        const itemTables = this.getArrays()

        for (let i = 0; i < itemTables.length; i++) {
            itemTables[i].splice(toId, 0, itemTables[i].splice(fromId, 1)[0])
        }

        this.saveArraysToRom(itemTables, weaponMode)
    }

    saveAs(romPath) {
        fs.writeFileSync(romPath, this.ROM)
    }

    ripWeaponAnimationData(wpnId, options = {
        header: true,
        wpnAnimData: true,
        rightHandData: true,
        leftHandData: false

    }) {
        // Get "Weapon Animation Data" Table (ECE400)
        let wpnAnimData = this.getArrays()[4][wpnId]

        // Get "Pointers to Battle Animation Scripts" Table (D1EAD8)
        let animPointersTable = this.ROM.subarray(0x11EAD8, 0x11F000)
        let animPointersArray = []
        for (let i = 0; i < (animPointersTable.length / 2); i++) {
            let c = i * 2
            // Already converting it to normal an offset string, for practicality.
            animPointersArray.push(toHex(readLE(animPointersTable.subarray(c, c + 2)) + 0xD00000))
        }

        // Rip data from ECE400 ("Weapon Animation Data")
        let rightHandAnimIndex = wpnAnimData[0]
        let leftHandAnimIndex = wpnAnimData[1]
        let attackSFX = wpnAnimData[6]

        // Get "Pointers to Battle Animation Frame Data" (D4DF3C)
        let framePointersTable = this.ROM.subarray(0x14DF3C, 0x150000)
        let framePointersArray = []
        for (let i = 0; i < (framePointersTable.length / 2); i++) {
            let c = i * 2
            framePointersArray.push((readLE(framePointersTable.subarray(c, c + 2)) + 0xD10000))
        }

        
        // Get "Attack Graphics Data" Table (D4D000)
        let atkGraphsTable = this.ROM.subarray(0x14D000, 0x14DF3C)

        let R_atkGraphsData = splitBuffer(atkGraphsTable, 6)[rightHandAnimIndex]
        let L_atkGraphsData = splitBuffer(atkGraphsTable, 6)[leftHandAnimIndex]

        // Rip data from right hand animation of the weapon.
        let R_bppFormat = "2bpp"
        if ((R_atkGraphsData[0] & 0b10000000) === 0) { R_bppFormat = '3bpp' }
        
        let R_numberOfFrames = R_atkGraphsData[0] & 0b00111111
        let R_tileFormationId = R_atkGraphsData[1] | ((R_atkGraphsData[0] & 0b01000000) << 2)

        let R_frameDataValue = readLE(R_atkGraphsData.subarray(2, 3))
        let R_frameDataAddr = (R_frameDataValue * 2) + 0xD4DF3C
        
        let R_frameWidth = R_atkGraphsData[4]
        let R_frameHeight = R_atkGraphsData[5]

        // Rip data from left hand animation of the weapon.
        let L_bppFormat = "2bpp"
        if ((L_atkGraphsData[0] & 0b10000000) === 0) { L_bppFormat = '3bpp' }
        
        let L_numberOfFrames = L_atkGraphsData[0] & 0b00111111
        let L_tileFormationId = L_atkGraphsData[1] | ((L_atkGraphsData[0] & 0b01000000) << 2)

        let L_frameDataValue = readLE(L_atkGraphsData.subarray(2, 3))
        let L_frameDataAddr = (L_frameDataValue * 2) + 0xD4DF3C

        let L_frameWidth = L_atkGraphsData[4]
        let L_frameHeight = L_atkGraphsData[5]

        // Log options

        let msg = ""

        if (options.header) {
            msg +=
`======================================================
Item ${wpnId} ($${toHex(wpnId)})
======================================================`
        }

        if (options.wpnAnimData) {
            msg += `
- Weapon Animation Data ($${toHex(0xECE400 + wpnId * 8)}) -
Right hand animation index: $${toHex(rightHandAnimIndex)} (Address: $${animPointersArray[rightHandAnimIndex]})
Left hand animation index: $${toHex(rightHandAnimIndex)} (Address: $${animPointersArray[leftHandAnimIndex]})
Sound Effect: ${(attackSFX)} $(${toHex(attackSFX)})
`
        }

        if (options.rightHandData) {
            msg += `
- Right Hand Attack Animation Data ($${toHex(0xD4D000 + rightHandAnimIndex * 6)}) -
Graphics format: ${(R_bppFormat)}
Number of frames: ${(R_numberOfFrames)}
Tile formation index: $${toHex(R_tileFormationId)} (Address: $${toHex(R_tileFormationId * 64 + 0xD20000)})
Frame data index: $${toHex(R_frameDataValue)} (Address: $${toHex(R_frameDataAddr)}, size: ${R_numberOfFrames*2})
Frame width: ${(R_frameWidth)}
Frame height: ${(R_frameHeight)}
`       
        }

        if (options.leftHandData) {
            msg += `
- Left Hand Attack Animation Data ($${toHex(0xD4D000 + leftHandAnimIndex * 6)}) -
Graphics format: ${(L_bppFormat)}
Number of frames: ${(L_numberOfFrames)}
Tile formation index: $${toHex(L_tileFormationId)} $(Address: $${toHex(L_tileFormationId * 64 + 0xD20000)})
Frame data index: $${toHex(L_frameDataValue)} (Address: $${toHex(L_frameDataAddr)}, size: ${L_numberOfFrames*2})
Frame width: ${(L_frameWidth)}
Frame height: ${(L_frameHeight)}
`
        }
        
        console.log(msg)
    }
}

const itemHandler = new ItemHandler(__dirname + '/sasatest.smc')


itemHandler.ripWeaponAnimationData(30)
