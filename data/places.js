/*
 * Dữ liệu địa điểm Bangkok cho BKK Swipe.
 * Tổng hợp từ các bài hướng dẫn/tin tức đăng 2025–2026 (xem `sources` của từng nơi), kiểm tra ngày 2026-11-16.
 * - approx:true  = tọa độ gần đúng (chỉ dùng để ước tính khoảng cách; nút "Chỉ đường" dùng TÊN nên vẫn đúng ghim).
 * - check:true   = thông tin còn trái chiều/chưa chắc, app sẽ hiện cảnh báo.
 * - slots        = buổi phù hợp để xếp lịch: morning | afternoon | evening | night
 * - windows      = (tuỳ chọn) chỉ mở vào thứ nhất định. days dùng JS: 0=CN ... 5=Thứ Sáu, 6=Thứ Bảy
 * Giờ mở cửa có thể thay đổi, đặc biệt dịp lễ. Luôn kiểm tra lại trên Google Maps trước khi đi.
 */
(function (root) {
  root.BKK_PLACES = [
    {
      id: "yaowarat", name: "Phố ẩm thực Yaowarat (Chinatown)", q: "Yaowarat Road Bangkok",
      emoji: "🦐", cats: ["food", "photo", "night"], lat: 13.7390, lng: 100.5088, approx: false,
      area: "Chinatown", transit: "MRT Wat Mangkon", hours: "Chiều tối đến khuya (sôi động nhất sau ~18:00)",
      price: 2, priceNote: "Hải sản nướng, vịt quay, trứng chiên hàu, tráng miệng",
      slots: ["evening", "night"], dur: 120,
      blurb: "Con phố ăn đêm nổi tiếng nhất Bangkok: bếp than, hải sản, vịt quay, đèn neon. Một điểm vừa ăn vừa chụp ảnh.",
      tips: ["Đi sau 17:00–18:00 khi gian hàng đã dựng đủ.", "Rất đông và hỗn loạn, hãy đi cả nhóm và giữ đồ.", "Chọn quán đông khách, đồ ăn quay vòng nhanh."],
      warn: null,
      sources: [
        { t: "Nomads Beyond", u: "https://nomadsbeyond.com/chinatown-bangkok-street-food/" },
        { t: "Nomado Travel", u: "https://www.nomadotravel.app/en/guides/bangkok-street-food-guide" }
      ]
    },
    {
      id: "jayfai", name: "Raan Jay Fai (cô Fai kính bảo hộ)", q: "Raan Jay Fai Bangkok",
      emoji: "🦀", cats: ["food"], lat: 13.7527, lng: 100.5047, approx: true,
      area: "Phra Nakhon (Old Town)", transit: "Grab/taxi", hours: "Kiểm tra giờ trên Google Maps",
      price: 3, priceNote: "Quán vỉa hè hạng Michelin, giá cao hơn phố thường",
      slots: ["afternoon", "evening"], dur: 90,
      blurb: "Bà chủ đeo kính bảo hộ là biểu tượng của ẩm thực đường phố Bangkok. Món nổi tiếng là xào kiểu Thái-Hoa với hải sản.",
      tips: ["Thường phải đặt chỗ hoặc xếp hàng rất lâu, hãy kiểm tra trước.", "Nên đi sớm trong ngày để dự phòng."],
      warn: "Giờ mở cửa và cách đặt chỗ hay thay đổi, cần kiểm tra trước khi đi.", check: true,
      sources: [{ t: "Pelago", u: "https://pelago.com/ko/articles/best-street-food-in-bangkok" }]
    },
    {
      id: "jokprince", name: "Jok Prince (cháo Bib Gourmand)", q: "Jok Prince Bangkok",
      emoji: "🥣", cats: ["food"], lat: 13.7400, lng: 100.5105, approx: true,
      area: "Chinatown", transit: "MRT Wat Mangkon", hours: "Kiểm tra giờ trên Google Maps",
      price: 1, priceNote: "Cháo trứng lòng đào, giá bình dân",
      slots: ["morning", "evening"], dur: 60,
      blurb: "Quán cháo kiểu Hoa mịn, trứng lòng đào, được liệt vào danh sách Bib Gourmand. Hợp để ăn nhẹ khi đi dạo Chinatown.",
      tips: ["Kết hợp với dạo phố Yaowarat trong cùng một buổi.", "Mang tiền mặt cho các quán nhỏ."],
      warn: "Giờ mở cửa chưa được xác nhận, hãy kiểm tra trên Google Maps.", check: true,
      sources: [{ t: "Nomadic Experiences", u: "https://www.nomadicexperiences.com/2026/07/bangkok-food-guide-where-to-eat-best.html" }]
    },
    {
      id: "khaosan", name: "Khao San Road", q: "Khao San Road Bangkok",
      emoji: "🍹", cats: ["food", "night", "photo"], lat: 13.7590, lng: 100.4974, approx: false,
      area: "Banglamphu", transit: "Grab/taxi hoặc thuyền Phra Arthit", hours: "Chiều tối đến rất khuya",
      price: 1, priceNote: "Đồ ăn vặt, bia, quán bar, đồ lưu niệm",
      slots: ["evening", "night"], dur: 90,
      blurb: "Phố ba-lô huyền thoại: nhạc, bar, đồ ăn vặt và người từ khắp nơi. Ồn ào nhưng vui, hợp tối cuối cả nhóm xõa.",
      tips: ["Đi cùng ngày với Wat Pho/Grand Palace vì cùng khu Old Town.", "Hỏi giá trước khi mua, mặc cả nhẹ."],
      warn: null,
      sources: [{ t: "KhaosanRoad.com", u: "https://www.khaosanroad.com/articles/bangkok-street-food-guide-khao-san-road-and-beyond" }]
    },
    {
      id: "watarun", name: "Wat Arun (Chùa Bình Minh)", q: "Wat Arun Bangkok",
      emoji: "🛕", cats: ["photo"], lat: 13.7437, lng: 100.4889, approx: false,
      area: "Bên kia sông Chao Phraya", transit: "Thuyền qua sông từ bến Tha Tien", hours: "08:00–18:00 hằng ngày",
      price: 1, priceNote: "Có vé vào cổng, kiểm tra giá hiện hành",
      slots: ["morning", "evening"], dur: 90,
      blurb: "Bảo tháp trang trí bằng sứ và vỏ sò, đẹp nhất lúc hoàng hôn. Địa điểm chụp ảnh nổi bật nhất Bangkok.",
      tips: ["Cách đi đẹp nhất là đi thuyền qua sông.", "Hoàng hôn đẹp nhưng đông, hãy đến sớm để chọn góc.", "Mặc trang phục kín đáo khi vào chùa."],
      warn: null,
      sources: [
        { t: "Kempinski", u: "https://www.kempinski.com/en/travelling-in-style/bangkok-s-best-photo-spots-instagrammable-moments" },
        { t: "Hoteles.com", u: "https://en.hoteles.com/go/thailand/most-bangkok-photographed-places" }
      ]
    },
    {
      id: "watpho", name: "Wat Pho (Phật nằm)", q: "Wat Pho Bangkok",
      emoji: "🛌", cats: ["photo"], lat: 13.7465, lng: 100.4927, approx: false,
      area: "Old Town", transit: "Thuyền Tha Tien hoặc Grab", hours: "Ban ngày, kiểm tra giờ trên Google Maps",
      price: 1, priceNote: "Có vé vào cổng",
      slots: ["morning"], dur: 90,
      blurb: "Tượng Phật nằm dát vàng khổng lồ và quần thể chùa nhiều bảo tháp. Rất đẹp nhưng chật chội vào ban ngày.",
      tips: ["Đến sớm để tránh đông.", "Đi bộ qua Wat Arun bằng thuyền trong cùng buổi."],
      warn: null,
      sources: [{ t: "Travel and Destinations", u: "https://www.travelanddestinations.com/?p=10131" }]
    },
    {
      id: "grandpalace", name: "Cung điện Hoàng gia (Grand Palace)", q: "Grand Palace Bangkok",
      emoji: "👑", cats: ["photo"], lat: 13.7500, lng: 100.4913, approx: false,
      area: "Old Town", transit: "Thuyền Tha Chang hoặc Grab", hours: "Ban ngày, kiểm tra giờ trên Google Maps",
      price: 2, priceNote: "Vé cao hơn các chùa khác, kiểm tra giá hiện hành",
      slots: ["morning"], dur: 120,
      blurb: "Quần thể cung điện và chùa Phật Ngọc, ánh vàng rực rỡ dưới nắng. Biểu tượng nhất của Bangkok.",
      tips: ["Yêu cầu trang phục kín vai và đầu gối.", "Đề phòng người mời đi tour giữa đường, chỉ mua vé ở quầy chính thức.", "Đến ngay khi mở cửa."],
      warn: "Đôi khi đóng cửa vào ngày có nghi lễ hoàng gia, cần kiểm tra trước.", check: true,
      sources: [{ t: "Hoteles.com", u: "https://en.hoteles.com/go/thailand/most-bangkok-photographed-places" }]
    },
    {
      id: "benchamabophit", name: "Wat Benchamabophit (Chùa Cẩm Thạch)", q: "Wat Benchamabophit Bangkok",
      emoji: "🏛️", cats: ["photo"], lat: 13.7670, lng: 100.5142, approx: false,
      area: "Dusit", transit: "Grab/taxi", hours: "Ban ngày, kiểm tra giờ trên Google Maps",
      price: 1, priceNote: "Có vé vào cổng nhỏ",
      slots: ["morning", "afternoon"], dur: 60,
      blurb: "Ngôi chùa đá cẩm thạch trắng thanh lịch, vắng hơn hẳn các chùa trung tâm. Hợp cho ai thích ảnh kiến trúc yên tĩnh.",
      tips: ["Mặc kín đáo khi vào chùa.", "Gắn với chuyến đi hướng Chatuchak/Dusit sẽ thuận đường hơn."],
      warn: null,
      sources: [{ t: "One Bangkok", u: "https://www.onebangkok.com/en/blog/best-photo-spots-bangkok/" }]
    },
    {
      id: "skywalk", name: "Mahanakhon SkyWalk & Sky Beach", q: "King Power Mahanakhon SkyWalk Bangkok",
      emoji: "🌆", cats: ["photo", "sky"], lat: 13.7234, lng: 100.5280, approx: false,
      area: "Silom/Sathorn", transit: "BTS Chong Nonsi", hours: "SkyWalk ban ngày đến ~19:00, kiểm tra giờ hiện hành",
      price: 3, priceNote: "Vé tham quan khá cao, mua online để đỡ xếp hàng",
      slots: ["evening"], dur: 90,
      blurb: "Tòa nhà cao nhất Bangkok, sàn kính tầng 78 và quầy bar ngoài trời Sky Beach. Ngắm hoàng hôn rồi lên đèn.",
      tips: ["Lên Sky Beach cần có vé SkyWalk.", "Mua vé online để khỏi xếp hàng dưới tầng trệt.", "Đến trước hoàng hôn khoảng một tiếng."],
      warn: "Các nguồn ghi giờ khác nhau, hãy kiểm tra giờ và quy định trước khi đi.", check: true,
      sources: [
        { t: "Phuket101", u: "https://www.phuket101.net/bangkok/best-rooftop-bars-in-bangkok/" },
        { t: "The Rooftop Guide", u: "https://www.therooftopguide.com/features/bangkok-dress-code.html" }
      ]
    },
    {
      id: "lebua", name: "Sky Bar tại Lebua (tầng 63)", q: "Sky Bar Lebua at State Tower Bangkok",
      emoji: "🍸", cats: ["sky", "photo"], lat: 13.7219, lng: 100.5165, approx: false,
      area: "Silom, ven sông", transit: "BTS Saphan Taksin", hours: "Chiều tối đến khuya",
      price: 3, priceNote: "Cocktail đắt, có thể có mức chi tối thiểu",
      slots: ["evening", "night"], dur: 90,
      blurb: "Quầy bar rooftop view sông và thành phố kịch tính nhất, quen thuộc từ nhiều bộ phim.",
      tips: ["Chỉ uống nước thì nói rõ để không bị dẫn vào nhà hàng bữa tối đắt tiền.", "Kiểm tra dress code trước, thường không nhận quần short, dép."],
      warn: null,
      sources: [{ t: "The Rooftop Guide", u: "https://www.therooftopguide.com/features/bangkok-dress-code.html" }]
    },
    {
      id: "octave", name: "Octave Rooftop (Marriott Sukhumvit)", q: "Octave Rooftop Lounge & Bar Bangkok",
      emoji: "🌃", cats: ["sky"], lat: 13.7262, lng: 100.5848, approx: true,
      area: "Thonglor", transit: "BTS Thong Lo", hours: "Chiều tối đến khuya",
      price: 3, priceNote: "Giá dễ chịu hơn nhiều rooftop siêu sang",
      slots: ["evening", "night"], dur: 90,
      blurb: "Ba tầng ngoài trời (tầng 45–49) với view 360 độ, nhạc nhẹ, hợp ngắm hoàng hôn khu Sukhumvit.",
      tips: ["Đi vào lúc hoàng hôn để thấy cả ngày và đêm.", "Kiểm tra dress code trước."],
      warn: null,
      sources: [
        { t: "Thailand Magazine", u: "https://thailandmagazine.com/bangkok/rooftop-bars/octave-rooftop-lounge-bar/" },
        { t: "Pickyourtrail", u: "https://pickyourtrail.com/tourism/thailand/best-rooftop-bars-in-bangkok" }
      ]
    },
    {
      id: "redsky", name: "Red Sky (Centara Grand CentralWorld)", q: "Red Sky Bar Centara Grand CentralWorld Bangkok",
      emoji: "🔴", cats: ["sky"], lat: 13.7469, lng: 100.5394, approx: false,
      area: "Siam / Chit Lom", transit: "BTS Chit Lom", hours: "~17:00–01:00 (theo một nguồn, có thể thay đổi)",
      price: 3, priceNote: "Cocktail, nhà hàng cao tầng",
      slots: ["evening", "night"], dur: 90,
      blurb: "Rooftop tầng 55 ngay giữa khu Siam, thuận tiện nếu nhóm đã đi mua sắm quanh đó.",
      tips: ["Không mặc quần short, áo ba lỗ, dép xỏ ngón.", "Rất tiện đi sau khi mua sắm ở Siam, CentralWorld."],
      warn: null,
      sources: [
        { t: "Trazy", u: "https://blog.trazy.com/top-sky-bars-in-bangkok/" },
        { t: "Expique", u: "https://expique.com/?p=1059" }
      ]
    },
    {
      id: "vertigo", name: "Vertigo & Moon Bar (Banyan Tree)", q: "Vertigo and Moon Bar Banyan Tree Bangkok",
      emoji: "🌙", cats: ["sky", "photo"], lat: 13.7233, lng: 100.5398, approx: true,
      area: "Sathorn", transit: "MRT Lumphini / BTS Chong Nonsi", hours: "Dự kiến mở lại 2/12/2026",
      price: 3, priceNote: "Rooftop sang trọng",
      slots: ["evening", "night"], dur: 90,
      blurb: "Rooftop ngoài trời tầng 61 nổi tiếng, nhưng đang đóng cửa để sửa chữa.",
      tips: ["Chỉ chọn nếu đã xác nhận lịch mở lại gần ngày đi."],
      warn: "Đóng cửa để tu sửa, theo một nguồn dự kiến mở lại ngày 2/12/2026. Hãy xác nhận trước khi đưa vào lịch.", check: true,
      sources: [{ t: "Thai Holiday Guide", u: "https://www.thaiholidayguide.com/rooftop-bars-bangkok/" }]
    },
    {
      id: "mbk", name: "MBK Center", q: "MBK Center Bangkok",
      emoji: "🛍️", cats: ["shop"], lat: 13.7447, lng: 100.5299, approx: false,
      area: "Siam", transit: "BTS National Stadium", hours: "Trung tâm thương mại, khoảng 10:00–22:00",
      price: 1, priceNote: "Quần áo, phụ kiện, điện tử, đồ lưu niệm giá mềm",
      slots: ["afternoon"], dur: 120,
      blurb: "Trung tâm mua sắm bình dân và đông vui, mặc cả được, nhiều đồ lưu niệm.",
      tips: ["Cân nhắc mặc cả ở các quầy nhỏ.", "Đi bộ nối với Siam Paragon và CentralWorld."],
      warn: null,
      sources: [
        { t: "30 Sundays", u: "https://www.30sundays.club/blog/bangkoks-must-visit-shopping-centers" },
        { t: "Pickyourtrail", u: "https://pickyourtrail.com/tourism/thailand/best-malls-in-bangkok" }
      ]
    },
    {
      id: "paragon", name: "Siam Paragon (food hall & thủy cung)", q: "Siam Paragon Bangkok",
      emoji: "🏬", cats: ["shop", "food"], lat: 13.7462, lng: 100.5347, approx: false,
      area: "Siam", transit: "BTS Siam", hours: "10:00–22:00 hằng ngày",
      price: 2, priceNote: "Thương hiệu tầm trung đến cao cấp, food hall tầng trệt",
      slots: ["afternoon"], dur: 120,
      blurb: "Trung tâm thương mại hàng đầu khu Siam, có khu ẩm thực lớn và thủy cung dưới tầng hầm.",
      tips: ["Điều hòa mát, hợp để tránh nắng buổi chiều.", "Gần MBK và CentralWorld nên xếp cùng buổi."],
      warn: null,
      sources: [
        { t: "Klook", u: "https://www.klook.com/en-PH/blog/shopping-in-bangkok-guide" },
        { t: "Nomado Travel", u: "https://www.nomadotravel.app/en/guides/bangkok-malls-guide" }
      ]
    },
    {
      id: "iconsiam", name: "ICONSIAM (ven sông)", q: "ICONSIAM Bangkok",
      emoji: "🛳️", cats: ["shop", "food", "photo"], lat: 13.7266, lng: 100.5101, approx: false,
      area: "Thonburi, ven sông", transit: "Thuyền miễn phí từ bến Sathorn", hours: "10:00–22:00 hằng ngày",
      price: 2, priceNote: "Mua sắm, chợ nổi trong nhà, nhà hàng nhìn ra sông",
      slots: ["afternoon", "evening"], dur: 150,
      blurb: "Trung tâm thương mại ven sông hoành tráng, có khu chợ nổi trong nhà và nhiều nhà hàng.",
      tips: ["Đi thuyền từ bến Sathorn rất tiện và đẹp.", "Nên dành ít nhất nửa buổi."],
      warn: null,
      sources: [
        { t: "Klook", u: "https://www.klook.com/en-PH/blog/shopping-in-bangkok-guide" },
        { t: "Pickyourtrail", u: "https://pickyourtrail.com/tourism/thailand/best-malls-in-bangkok" }
      ]
    },
    {
      id: "pratunam", name: "Pratunam & Platinum Fashion Mall", q: "Platinum Fashion Mall Bangkok",
      emoji: "👗", cats: ["shop"], lat: 13.7516, lng: 100.5411, approx: false,
      area: "Pratunam", transit: "BTS Chit Lom / Ratchathewi", hours: "Khoảng 10:00–21:00",
      price: 1, priceNote: "Thời trang bán sỉ, giá cố định thấp",
      slots: ["afternoon"], dur: 120,
      blurb: "Thiên đường thời trang giá sỉ, nhiều đồ quần áo mua một vài món vẫn rẻ.",
      tips: ["Mua nhiều món sẽ được giá tốt hơn.", "Chợ Pratunam ngay cạnh, nên đi bộ sang."],
      warn: null,
      sources: [
        { t: "Klook", u: "https://www.klook.com/en-PH/blog/shopping-in-bangkok-guide" },
        { t: "Pickyourtrail", u: "https://pickyourtrail.com/tourism/thailand/best-malls-in-bangkok" }
      ]
    },
    {
      id: "terminal21", name: "Terminal 21 (Asok)", q: "Terminal 21 Bangkok",
      emoji: "✈️", cats: ["shop", "food"], lat: 13.7377, lng: 100.5603, approx: false,
      area: "Sukhumvit / Asok", transit: "BTS Asok / MRT Sukhumvit", hours: "Trung tâm thương mại, kiểm tra giờ",
      price: 1, priceNote: "Food court giá hợp lý, trang trí theo chủ đề các thành phố",
      slots: ["afternoon", "evening"], dur: 120,
      blurb: "Mỗi tầng trang trí theo một thành phố trên thế giới, vui mắt để chụp ảnh, có food court dễ ăn.",
      tips: ["Phù hợp ăn trưa muộn hoặc ăn tối đơn giản.", "Nối thẳng sang ga BTS Asok."],
      warn: null,
      sources: [{ t: "Pickyourtrail", u: "https://pickyourtrail.com/tourism/thailand/best-malls-in-bangkok" }]
    },
    {
      id: "jodd", name: "Jodd Fairs Ratchada", q: "Jodd Fairs Ratchada Bangkok",
      emoji: "🏮", cats: ["night", "food", "shop", "photo"], lat: 13.7652, lng: 100.5722, approx: true,
      area: "Ratchada", transit: "MRT Thailand Cultural Centre (cửa 4)", hours: "16:00–24:00 hằng ngày, miễn phí vào cổng",
      price: 1, priceNote: "Đồ ăn đường phố, đồ chơi, quần áo, lưu niệm",
      slots: ["evening", "night"], dur: 120,
      blurb: "Chợ đêm trẻ trung nhất Bangkok hiện nay, gọn gàng sáng đèn, hơn 1.500 gian hàng và rất hợp chụp ảnh.",
      tips: ["Chợ đã chuyển từ Rama 9 sang Ratchada, một số bài cũ vẫn ghi vị trí cũ.", "Đi bộ được sang Train Night Market Ratchada."],
      warn: "Một số nguồn cũ vẫn ghi địa chỉ Rama 9, hãy đặt ghim đúng 'Jodd Fairs Ratchada' trên Google Maps.", check: true,
      sources: [
        { t: "Traveloka", u: "https://www.traveloka.com/en-my/explore/destination/bangkok-night-market-guide-acc/1009521" },
        { t: "THAIest", u: "https://thaiest.com/thailand/bangkok/night-markets" },
        { t: "Thai Holiday Guide", u: "https://www.thaiholidayguide.com/attraction/jodd-fairs/" }
      ]
    },
    {
      id: "trainratchada", name: "Train Night Market Ratchada", q: "Train Night Market Ratchada Bangkok",
      emoji: "🚂", cats: ["night", "food", "shop"], lat: 13.7675, lng: 100.5738, approx: true,
      area: "Ratchada (sau Esplanade)", transit: "MRT Thailand Cultural Centre", hours: "Buổi tối, kiểm tra giờ",
      price: 1, priceNote: "Đồ cũ, đồ thủ công, ăn vặt, quán bar nhỏ",
      slots: ["evening", "night"], dur: 90,
      blurb: "Chợ đêm lều màu sắc nổi tiếng, đồ ăn rẻ và đa dạng, cách Jodd Fairs một ga MRT.",
      tips: ["Có thể đi bộ giữa hai chợ trong một buổi tối."],
      warn: "Thông tin trái chiều: một nguồn nói chợ mở lại từ 27/3/2026, nguồn khác nói chợ cũ đã đóng. Xác nhận trên Google Maps trước khi đi.", check: true,
      sources: [
        { t: "Phuket101", u: "https://www.phuket101.net/bangkok/train-night-market-ratchada/" },
        { t: "Thai Holiday Guide", u: "https://www.thaiholidayguide.com/attraction/train-night-market-srinakarin/" }
      ]
    },
    {
      id: "chatuchak", name: "Chợ Chatuchak (cuối tuần & đêm thứ Sáu)", q: "Chatuchak Weekend Market Bangkok",
      emoji: "🧺", cats: ["shop", "food"], lat: 13.7998, lng: 100.5503, approx: false,
      area: "Chatuchak", transit: "MRT Kamphaeng Phet / Chatuchak Park, BTS Mo Chit", hours: "Thứ Bảy 09:00–18:00; tối thứ Sáu quy mô nhỏ hơn",
      price: 1, priceNote: "Hàng thủ công, quần áo, đồ gia dụng, ăn vặt",
      slots: ["morning", "afternoon", "evening", "night"],
      windows: [
        { days: [6], slots: ["morning", "afternoon"] },
        { days: [5], slots: ["evening", "night"] }
      ],
      blurb: "Khu chợ lớn nhất thế giới với hàng chục nghìn gian hàng. Chuyến này rơi đúng thứ Sáu 11/12 và thứ Bảy 12/12.",
      tips: ["Thứ Bảy 12/12 là ngày chợ đầy đủ, nhưng cũng là ngày về nên cần tính giờ bay.", "Tối thứ Sáu 11/12 chỉ mở một phần, thiên về hàng sỉ.", "Thứ Hai, Thứ Ba chợ đóng cửa, đừng nhầm ngày.", "Mang tiền mặt, đi sớm cho mát."],
      warn: "Chợ đầy đủ chỉ mở Thứ Bảy–Chủ Nhật, nên chỉ xếp vào 11/12 (đêm) hoặc sáng 12/12.", check: true,
      sources: [
        { t: "Thai Holiday Guide", u: "https://www.thaiholidayguide.com/attraction/chatuchak-weekend-market/" },
        { t: "Thailand Magazine", u: "https://thailandmagazine.com/bangkok/see-do/chatuchak-weekend-market/" },
        { t: "CK Travels", u: "https://www.cktravels.com/chatuchak-weekend-market-bangkok-ultimate-guide" }
      ]
    },
    {
      id: "asiatique", name: "Asiatique The Riverfront", q: "Asiatique The Riverfront Bangkok",
      emoji: "🎡", cats: ["night", "shop", "photo", "food"], lat: 13.7042, lng: 100.5032, approx: false,
      area: "Ven sông, Charoen Krung", transit: "Thuyền miễn phí từ bến Sathorn", hours: "16:00–24:00 hằng ngày",
      price: 2, priceNote: "Nhà hàng ven sông, cửa hàng boutique, vòng đu quay",
      slots: ["evening", "night"], dur: 150,
      blurb: "Khu mua sắm ngoài trời trong dãy kho cũ ven sông, có vòng đu quay và nhà hàng nhìn ra nước, phù hợp một tối thư thả.",
      tips: ["Đi thuyền miễn phí từ bến Sathorn rất tiện.", "Giống trung tâm thương mại ngoài trời hơn chợ đêm truyền thống."],
      warn: null,
      sources: [
        { t: "Pattayatalk", u: "https://pattayatalk.com/things-to-do/bangkok-markets-food" },
        { t: "Traveloka", u: "https://www.traveloka.com/en-my/explore/destination/bangkok-night-market-guide-acc/1009521" }
      ]
    }
  ];
})(typeof window !== "undefined" ? window : globalThis);
